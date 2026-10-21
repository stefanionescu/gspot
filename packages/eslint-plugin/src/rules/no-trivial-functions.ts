import { createRule } from '../schemas/rules/options.ts';
import type { ImplementedFunction } from '../types/syntax.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import { countStatements, findOutermostValue } from '../syntax.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { trivialFunctionsOptionsSchema } from '../schemas/rules/no/trivial.ts';
import { FUNCTION_SELECTOR, INLINE_VALUE_PARENTS, TRIVIAL_FUNCTION_STATEMENTS } from '../config/syntax.ts';

/**
 * Check whether a function fills a slot that takes a callback: an argument, a return value, an array element,
 * a property, an assigned member, or JSX. Such a function has no name, so the rule leaves it out.
 *
 * @param node the function implementation
 * @returns whether the slot needs an inline function
 */
function isInlineValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration || node.id !== null) return false;
    const value = findOutermostValue(node);
    return INLINE_VALUE_PARENTS.has(value.parent.type) || isValueSlot(value);
}

// A property value, an assigned member, or an argument takes a function value. A method shorthand or an accessor in an
// object literal counts as a named method, and a function assigned to a variable takes its name.
function isValueSlot(value: TSESTree.Expression): boolean {
    const parent = value.parent;
    switch (parent.type) {
        case AST_NODE_TYPES.Property: {
            return parent.kind === 'init' && !parent.method;
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return parent.left.type === AST_NODE_TYPES.MemberExpression;
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

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. An anonymous function written inline as an argument has no name, so the rule leaves it out. A function that must stay, such as a method that an interface requires, gets a suppression comment with its reason.',
            level: 'all',
            description:
                'Reports each named function with two statements or fewer at the default limit: function declarations, functions assigned to a name, methods, accessors, and constructors, exported or not.\n\n- The count includes nested callbacks.\n- An anonymous function written inline as a value, such as a callback argument, has no name and is not reported.',
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
                if (count > limit || isInlineValue(node)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements` },
                });
            },
        };
    },
});
