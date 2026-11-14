import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import {
    DEFAULT_FUNCTION_NESTING,
    FUNCTION_NESTING_OPTIONS_SCHEMA,
    TEST_STRUCTURE_CALLS,
} from '../../config/functions.ts';
import { getCalleeChain } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';

/**
Check whether a function is an argument of a call whose callee starts with a test structure name. The name decides
alone, so a test fixture that `test.extend` builds, and the tests of any framework, count too.
*/
function isTestStructureCallback(node: TSESTree.Node): boolean {
    const { parent } = node;
    const chain = parent?.type === AST_NODE_TYPES.CallExpression ? getCalleeChain(parent.callee) : undefined;
    return chain !== undefined && TEST_STRUCTURE_CALLS.has(chain.base.name);
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
            ':function': function (node: FunctionNode) {
                if (isTestStructureCallback(node)) return;
                const chain = [...context.sourceCode.getAncestors(node), node];
                const depth = chain.filter(
                    (each) => ASTUtils.isFunction(each) && !isTestStructureCallback(each),
                ).length;
                if (depth === threshold + 1) context.report({ node, messageId: 'nested', data: { threshold } });
            },
        };
    },
});
