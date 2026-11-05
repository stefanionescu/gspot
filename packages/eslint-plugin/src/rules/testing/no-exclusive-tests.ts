import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { EXCLUSIVE_TEST_NAMES } from '../../config/testing.ts';
import { isPlaywrightSuite } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';

export const noExclusiveTests = createRule<[], 'exclusive' | 'removeOnly'>({
    name: 'no-exclusive-tests',
    meta: {
        defaultOptions: [],
        type: 'problem',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            description:
                'Reports `.only` on `describe`, `context`, `it`, `specify`, and `test`, and on Playwright `test.describe` with its `parallel` and `serial` modifiers.',
            why: 'An exclusive test makes the runner skip every other test of the file or the run, so the suite passes while most of it never runs.',
            fix: 'Remove `.only` before you commit.',
            example: '`it.only("adds", run)` reports `exclusive`. Write `it("adds", run)`.',
        },
        schema: [],
        messages: {
            exclusive: 'Remove ".only" from this test, so the other tests run too.',
            removeOnly: 'Remove ".only".',
        },
    },
    create(context) {
        return {
            'CallExpression > MemberExpression.callee[computed=false][property.name="only"]'(
                node: TSESTree.MemberExpression,
            ) {
                const { object } = node;
                const isExclusive =
                    (object.type === AST_NODE_TYPES.Identifier && EXCLUSIVE_TEST_NAMES.has(object.name)) ||
                    isPlaywrightSuite(object);
                if (!isExclusive) return;
                context.report({
                    node: node.property,
                    messageId: 'exclusive',
                    suggest: [
                        {
                            messageId: 'removeOnly',
                            fix: (fixer) => fixer.removeRange([object.range[1], node.property.range[1]]),
                        },
                    ],
                });
            },
        };
    },
});
