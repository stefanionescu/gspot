import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { DEFAULT_FUNCTION_NESTING, FUNCTION_NESTING_OPTIONS_SCHEMA } from '../../config/functions.ts';
import { TEST_STRUCTURE_CALLS } from '../../config/testing.ts';
import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';

function isTestCallback(node: TSESTree.Node): boolean {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = parent;
    const target = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : callee;
    return ASTUtils.isIdentifier(target) && TEST_STRUCTURE_CALLS.has(target.name);
}

export const noNestedFunctions = createRule<[{ threshold: number }], 'nested'>({
    name: 'no-nested-functions',
    meta: {
        defaultOptions: [{ threshold: DEFAULT_FUNCTION_NESTING }],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a function nested deeper than `threshold` functions, five by default. Declarations, expressions, and arrow functions count. The callbacks of test structure calls, such as `describe`, `it`, and `beforeEach`, do not count.',
            why: 'Deeply nested functions are hard to follow, because each level adds its own scope and captured values.',
            fix: 'Move the inner functions to module level or into named functions, and pass them the values they need.',
            example: 'With the default threshold, the sixth function nested inside five others reports `nested`.',
        },
        schema: [FUNCTION_NESTING_OPTIONS_SCHEMA],
        messages: { nested: 'This function is nested more than {{threshold}} levels deep. Move it out.' },
    },
    create(context, [{ threshold }]) {
        return {
            ':function'(node: FunctionNode) {
                if (isTestCallback(node)) return;
                const chain = [...context.sourceCode.getAncestors(node), node];
                const depth = chain.filter((each) => ASTUtils.isFunction(each) && !isTestCallback(each)).length;
                if (depth === threshold + 1) context.report({ node, messageId: 'nested', data: { threshold } });
            },
        };
    },
});
