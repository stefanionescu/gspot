import { FUNCTIONS } from '#plugin/constants/plugin.ts';
import type { TSESLint } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { MethodDeclaration, Node, Type, TypeChecker } from 'typescript';
import type { ImplementedFunction, NoTrivialFunctionsOptions } from '#plugin/types/rules.ts';
import { hasConstructorState, hasSharedComputation, statementCount } from '#plugin/syntax.ts';
import { functionValue, functionUsage, isCallbackValue, isCallbackProperty } from '#plugin/function-references.ts';

import {
    isArrowFunction,
    isClassLike,
    isFunctionExpression,
    isMethodDeclaration,
    isObjectLiteralExpression,
} from 'typescript';

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    if (parent.kind === 'constructor') return hasConstructorState(node);
    return parent.kind !== 'method' || parent.override || ('decorators' in parent && parent.decorators.length > 0);
}

// Only an instance member named by an implemented interface or base class carries that inherited contract.
function classSignature(node: MethodDeclaration, checker: TypeChecker): Type | undefined {
    if (!isClassLike(node.parent)) return undefined;
    const name = checker.getSymbolAtLocation(node.name)?.getName();
    if (name === undefined) return undefined;
    for (const clause of node.parent.heritageClauses ?? [])
        for (const contract of clause.types) {
            const property = checker.getTypeAtLocation(contract).getProperty(name);
            if (property !== undefined) return checker.getTypeOfSymbolAtLocation(property, node);
        }
    return undefined;
}

// A contextual object member owns the method signature just as a typed variable owns a callback signature.
function contextualType(node: Node, checker: TypeChecker): Type | undefined {
    if (isArrowFunction(node) || isFunctionExpression(node)) return checker.getContextualType(node);
    if (!isMethodDeclaration(node)) return undefined;
    if (!isObjectLiteralExpression(node.parent)) return classSignature(node, checker);
    const contract = checker.getContextualType(node.parent);
    if (contract === undefined) return undefined;
    const name = checker.getSymbolAtLocation(node.name);
    if (name === undefined) return contract.getStringIndexType();
    const property = contract.getProperty(name.getName());
    return property === undefined ? contract.getStringIndexType() : checker.getTypeOfSymbolAtLocation(property, node);
}

// Type information establishes callback contracts without granting every export an exemption.
function hasContextualSignature(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (node.parent.type === AST_NODE_TYPES.MethodDefinition && node.parent.static) return false;
    const { program, esTreeNodeToTSNodeMap: mapping } = source.parserServices ?? {};
    if (!program || !mapping) return false;
    const implementation = mapping.get(node);
    const checker = program.getTypeChecker();
    const signature = contextualType(implementation, checker);
    if (signature === undefined) return false;
    const contract = checker.getNonNullableType(signature);
    const alternatives = contract.isUnion() ? contract.types : [contract];
    return alternatives.some((alternative) => alternative.getCallSignatures().length > 0);
}

const signatureChecks = [
    (node: ImplementedFunction) => node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate,
    isCallbackValue,
    isCallbackProperty,
    hasDeclaredSignature,
    hasContextualSignature,
];

export const noTrivialFunctions = createRule<NoTrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep functions substantive',
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. Callbacks passed as function values retain their required signature.',
            level: 'all',
            summary:
                'Finds short functions that add indirection without a required function value, recursive binding, signature, shared computation, or fixed arguments shared by multiple callers.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline unnecessary functions. Required external APIs need a narrow suppression with a reason.',
        },
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 } })],
        messages: {
            trivial:
                'This function has {{count}} executable statements, at most {{max}}. Inline it or explain its required API with a narrow suppression.',
        },
    },
    defaultOptions: [{ maxStatements: 2 }],
    create(context, [options]) {
        const max = options.maxStatements ?? 2;
        const callbackOwners = new WeakSet<ImplementedFunction>();
        const recordOwner = (node: ImplementedFunction, count: number): void => {
            if (count <= max && !callbackOwners.has(node)) return;
            const owner = context.sourceCode
                .getAncestors(node)
                .findLast((ancestor): ancestor is ImplementedFunction => FUNCTIONS.has(ancestor.type));
            if (owner !== undefined) callbackOwners.add(owner);
        };
        return {
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression):exit'(
                node: ImplementedFunction,
            ) {
                const count =
                    node.body.type === AST_NODE_TYPES.BlockStatement
                        ? statementCount(node.body, context.sourceCode.visitorKeys)
                        : 1;
                const usage = functionUsage(node, context.sourceCode);
                if (usage.required || signatureChecks.some((check) => check(node, context.sourceCode))) {
                    // A callback algorithm belongs to its enclosing function, even when expressed in one return.
                    recordOwner(node, count);
                    return;
                }
                if (hasSharedComputation(node, context.sourceCode)) return;
                const parent = functionValue(node).parent;
                if (count <= max && (!callbackOwners.has(node) || parent.type === AST_NODE_TYPES.CallExpression))
                    context.report({ node, messageId: 'trivial', data: { count, max } });
            },
        };
    },
});
