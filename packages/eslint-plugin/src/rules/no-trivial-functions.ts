import type { ImplementedFunction } from '../types/syntax.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import { createRule, buildOptionsSchema } from '../create-rule.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    VALUE_PARENTS,
    MIN_SHARED_READS,
    FUNCTION_SELECTOR,
    TRIVIAL_STATEMENTS,
    TRANSPARENT_EXPRESSIONS,
} from '../config/syntax.ts';
import {
    hasCalculation,
    countStatements,
    isTypePredicate,
    isExportedFunction,
    hasConstructorState,
    listCallableVariables,
} from '../syntax.ts';

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

// Parent types that take a function value, each with a test for the slot it fills.
const VALUE_HOLDERS: [AST_NODE_TYPES, (parent: TSESTree.Node, value: TSESTree.Node) => boolean][] = [
    [
        AST_NODE_TYPES.Property,
        (parent, value) =>
            (parent as TSESTree.Property).value === value && parent.parent?.type === AST_NODE_TYPES.ObjectExpression,
    ],
    [
        AST_NODE_TYPES.AssignmentExpression,
        (parent, value) =>
            (parent as TSESTree.AssignmentExpression).right === value &&
            (parent as TSESTree.AssignmentExpression).left.type === AST_NODE_TYPES.MemberExpression,
    ],
    [
        AST_NODE_TYPES.CallExpression,
        (parent, value) =>
            (parent as TSESTree.CallExpression).arguments.some((argument) => argument.range[0] === value.range[0]),
    ],
    [
        AST_NODE_TYPES.NewExpression,
        (parent, value) =>
            (parent as TSESTree.NewExpression).arguments.some((argument) => argument.range[0] === value.range[0]),
    ],
];

/**
 * Walk up through type assertions and conditional or logical expressions to the outermost value.
 * @param node the expression or declaration
 * @returns the outermost expression that wraps it
 */
function findOutermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) {
        const parent = value.parent;
        value = parent;
    }
    return value;
}

/**
 * Check whether a function fills a slot that takes a callback: an argument, a return value, an array element,
 * a property, an assigned member, or JSX.
 * @param node the function implementation
 * @returns whether the slot needs an inline function
 */
function isInlineValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = findOutermostValue(node);
    const parent = value.parent;
    if (parent.type === AST_NODE_TYPES.ArrayExpression || VALUE_PARENTS.has(parent.type)) return true;
    return VALUE_HOLDERS.find(([type]) => type === parent.type)?.[1](parent, value) ?? false;
}

/**
 * Check whether a function calls itself. Callers cannot inline such a body, because it names the function.
 * @param node the function implementation
 * @param source the parsed file, with its scopes
 * @returns whether a reference to the function sits inside its own body
 */
function isRecursive(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    return listCallableVariables(node, source)
        .flatMap((variable) => variable.references)
        .some(
            (reference) =>
                reference.isRead() &&
                reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery &&
                reference.identifier.range[0] >= node.range[0] &&
                reference.identifier.range[1] <= node.range[1],
        );
}

// An exported API may have callers in other modules. A local helper must have at least two reads.
function isSharedFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (isExportedFunction(node, source)) return true;
    return listCallableVariables(node, source).some(
        (variable) =>
            variable.references.filter(
                (reference) => reference.isRead() && reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery,
            ).length >= MIN_SHARED_READS,
    );
}

// A call through a type assertion or a non-null assertion still calls the function, and so does JSX.
function isCalled(identifier: TSESTree.Identifier | TSESTree.JSXIdentifier): boolean {
    if (identifier.type === AST_NODE_TYPES.JSXIdentifier) return true;
    const value = findOutermostValue(identifier);
    return value.parent.type === AST_NODE_TYPES.CallExpression && value.parent.callee === value;
}

// A function passed as a value from inside another function, and never called, keeps one identity. Inlining it creates
// a new function on each call, such as the subscribe argument of useSyncExternalStore, or a returned noop.
function isPassedOnly(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const reads = listCallableVariables(node, source).flatMap((variable) =>
        variable.references
            .filter(
                (reference) =>
                    reference.isRead() &&
                    reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery &&
                    (reference.identifier.range[0] < node.range[0] || reference.identifier.range[1] > node.range[1]),
            )
            .map((reference) => ({ reference, scope: variable.scope.variableScope })),
    );
    return (
        reads.length > 0 &&
        reads.every(({ reference, scope }) => reference.from.variableScope !== scope && !isCalled(reference.identifier))
    );
}

// Empty and argument-forwarding constructors already belong to no-useless-constructor.
function isRedundantConstructor(node: TSESTree.FunctionExpression): boolean {
    if (node.body.body.length === 0) return true;
    const [statement] = node.body.body;
    if (
        node.body.body.length !== 1 ||
        statement?.type !== AST_NODE_TYPES.ExpressionStatement ||
        statement.expression.type !== AST_NODE_TYPES.CallExpression ||
        statement.expression.callee.type !== AST_NODE_TYPES.Super
    )
        return false;
    const callArguments = statement.expression.arguments;
    return (
        callArguments.length === node.params.length &&
        callArguments.every(
            (argument, index) =>
                argument.type === AST_NODE_TYPES.Identifier &&
                node.params[index]?.type === AST_NODE_TYPES.Identifier &&
                argument.name === node.params[index].name,
        )
    );
}

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    if (parent.kind === 'constructor')
        return (
            hasConstructorState(node) ||
            (node.type === AST_NODE_TYPES.FunctionExpression && isRedundantConstructor(node))
        );
    return parent.kind !== 'method' || parent.override || parent.decorators.length > 0;
}

// Type information connects an instance method to the interface or base class that requires it.
function isInheritedMethod(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const method = node.parent;
    if (method.type !== AST_NODE_TYPES.MethodDefinition || method.static) return false;
    const owner = method.parent.parent;
    if (source.parserServices === undefined) return false;
    const { program, esTreeNodeToTSNodeMap: mapping } = source.parserServices;
    if (!program || !mapping) return false;
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(mapping.get(method.key));
    if (symbol === undefined) return false;
    return (mapping.get(owner).heritageClauses ?? []).some((clause) =>
        clause.types.some(
            (contract) => checker.getTypeAtLocation(contract).getProperty(symbol.getName()) !== undefined,
        ),
    );
}

// Each exemption identifies a language contract or an existing shared API.
function isRequiredFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (isTypePredicate(node)) return true;
    if (hasCalculation(node.body, source.visitorKeys)) return true;
    if (isInlineValue(node)) return true;
    if (isRecursive(node, source)) return true;
    if (isSharedFunction(node, source)) return true;
    if (isPassedOnly(node, source)) return true;
    if (hasDeclaredSignature(node)) return true;
    return isInheritedMethod(node, source);
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialStatements: TRIVIAL_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. A function written inline as an argument keeps its place, because the call takes a function.',
            level: 'all',
            description:
                'Reports named functions with two statements or fewer at the default limit.\n\n- The count includes nested callbacks.\n- Exempts inline function values, recursive functions, and type predicates.\n- Accessors, overrides, and decorated methods retain their language contracts.\n- Constructors that set state remain exempt.\n- The inherited-method exemption needs type information.\n- A function used in two or more places, or exported, is not reported.\n- A function passed as a value from inside another function, and never called, is not reported: inlining it creates a new function on each call.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it.',
        },
        schema: [
            buildOptionsSchema({
                trivialStatements: {
                    description: 'Functions with this many statements or fewer are reported.',
                    type: 'integer',
                    minimum: 1,
                },
            }),
        ],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const max = options.trivialStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: ImplementedFunction) {
                const count = countStatements(node, context.sourceCode.visitorKeys);
                if (count > max || isRequiredFunction(node, context.sourceCode)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements` },
                });
            },
        };
    },
});
