import { createRule } from '../schemas/rules/options.ts';
import type { ImplementedFunction } from '../types/syntax.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import { trivialFunctionsOptionsSchema } from '../schemas/rules/no/trivial.ts';
import { FUNCTION_SELECTOR, TRIVIAL_FUNCTION_STATEMENTS } from '../config/syntax.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getTypeServices, countStatements, findOutermostValue, listCallableVariables } from '../syntax.ts';

/**
 * Check whether a function fills a slot that takes a callback: an argument, a return value, an array element,
 * a property, an assigned member, or JSX.
 *
 * @param node the function implementation
 * @returns whether the slot needs an inline function
 */
function isInlineValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = findOutermostValue(node);
    const parent = value.parent;
    switch (parent.type) {
        case AST_NODE_TYPES.ArrayExpression:
        case AST_NODE_TYPES.ReturnStatement:
        case AST_NODE_TYPES.JSXExpressionContainer:
        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.AssignmentPattern: {
            return true;
        }
        default: {
            return isValueSlot(value);
        }
    }
}

// A property, assignment, or argument slot counts only when it holds this exact function value.
function isValueSlot(value: TSESTree.Expression): boolean {
    const parent = value.parent;
    switch (parent.type) {
        case AST_NODE_TYPES.Property: {
            return parent.value === value && parent.parent.type === AST_NODE_TYPES.ObjectExpression;
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return parent.right === value && parent.left.type === AST_NODE_TYPES.MemberExpression;
        }
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.NewExpression: {
            return parent.arguments.includes(value);
        }
        default: {
            return false;
        }
    }
}

/**
 * Check whether a function calls itself. Callers cannot inline such a body, because it names the function.
 *
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

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    return parent.kind !== 'method' || parent.override || parent.decorators.length > 0;
}

// Type information connects an instance method to the interface or base class that requires it.
function isInheritedMethod(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const method = node.parent;
    if (method.type !== AST_NODE_TYPES.MethodDefinition || method.static) return false;
    const owner = method.parent.parent;
    const services = getTypeServices(source);
    if (services === undefined) return false;
    const { checker, mapping } = services;
    const symbol = checker.getSymbolAtLocation(mapping.get(method.key));
    if (symbol === undefined) return false;
    return (mapping.get(owner).heritageClauses ?? []).some((clause) =>
        clause.types.some(
            (contract) => checker.getTypeAtLocation(contract).getProperty(symbol.getName()) !== undefined,
        ),
    );
}

// Callers cannot inline these functions. An inline value has no name, a recursive function names itself, and a
// method or accessor fills a contract of the language or of a type.
function isRequiredFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (isInlineValue(node)) return true;
    if (isRecursive(node, source)) return true;
    if (hasDeclaredSignature(node)) return true;
    return isInheritedMethod(node, source);
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. A function written inline as an argument keeps its place, because the call takes a function.',
            level: 'all',
            description:
                'Reports each named function with two statements or fewer at the default limit, exported or not.\n\n- The count includes nested callbacks.\n- Exempts inline function values and recursive functions, because they cannot be inlined.\n- Accessors, overrides, decorated methods, and constructors retain their language contracts.\n- The inherited-method exemption needs type information.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it.',
        },
        schema: [trivialFunctionsOptionsSchema],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const limit = options.trivialFunctionStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: ImplementedFunction) {
                const count = countStatements(node, context.sourceCode.visitorKeys);
                if (count > limit || isRequiredFunction(node, context.sourceCode)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements` },
                });
            },
        };
    },
});
