import type { TSESLint } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { DEFAULT_TRIVIAL_STATEMENTS } from '#plugin/config/rules.ts';
import { totalStatements, hasConstructorState } from '#plugin/syntax.ts';
import { isRecursive, isInlineValue } from '#plugin/function-references.ts';
import type { ImplementedFunction, NoTrivialFunctionsOptions } from '#plugin/types/rules.ts';
import { isClassLike, type TypeChecker, isMethodDeclaration, type MethodDeclaration } from 'typescript';

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    if (parent.kind === 'constructor') return hasConstructorState(node);
    return parent.kind !== 'method' || parent.override || ('decorators' in parent && parent.decorators.length > 0);
}

// Only an instance member named by an implemented interface or base class carries that inherited contract.
function implementsMember(node: MethodDeclaration, checker: TypeChecker): boolean {
    if (!isClassLike(node.parent)) return false;
    const name = checker.getSymbolAtLocation(node.name)?.getName();
    if (name === undefined) return false;
    return (node.parent.heritageClauses ?? []).some((clause) =>
        clause.types.some((contract) => checker.getTypeAtLocation(contract).getProperty(name) !== undefined),
    );
}

// A method an interface or base class declares must exist, so the class cannot inline it.
function hasInheritedContract(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (node.parent.type !== AST_NODE_TYPES.MethodDefinition || node.parent.static) return false;
    const { program, esTreeNodeToTSNodeMap: mapping } = source.parserServices ?? {};
    if (!program || !mapping) return false;
    const implementation = mapping.get(node);
    return isMethodDeclaration(implementation) && implementsMember(implementation, program.getTypeChecker());
}

export const noTrivialFunctions = createRule<NoTrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep functions substantive',
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. A function written inline as an argument keeps its place, because the call takes a function.',
            level: 'all',
            summary:
                'Finds named functions at or under the statement limit, counting the callbacks written inside them. A function the language forces stays: an inline function value, a recursive function, a type predicate, an accessor, an override, a decorated method, a constructor that sets state, or a method an interface or base class declares.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it. A required external API keeps the function under a narrow suppression with a reason.',
        },
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 } })],
        messages: {
            trivial:
                'This function has {{count}} executable statements, at most {{max}}. Inline it or explain its required API with a narrow suppression.',
        },
    },
    defaultOptions: [{ maxStatements: 2 }],
    create(context, [options]) {
        const max = options.maxStatements ?? DEFAULT_TRIVIAL_STATEMENTS;
        return {
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression):exit'(
                node: ImplementedFunction,
            ) {
                const count = totalStatements(node, context.sourceCode.visitorKeys);
                // The language forces these functions to exist: nothing can take their place at the call site.
                const required =
                    node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate ||
                    isInlineValue(node) ||
                    isRecursive(node, context.sourceCode) ||
                    hasDeclaredSignature(node) ||
                    hasInheritedContract(node, context.sourceCode);
                if (count > max || required) return;
                context.report({ node, messageId: 'trivial', data: { count, max } });
            },
        };
    },
});
