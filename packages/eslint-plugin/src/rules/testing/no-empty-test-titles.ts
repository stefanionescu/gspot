import { ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { RUNNING_TEST_MODIFIERS, TEST_FRAMEWORK_MODULES } from '../../config/testing.ts';
import { isModuleUsed } from '../../libraries/packages.ts';
import { getTestCall } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';

export const noEmptyTestTitles = createRule<[], 'empty'>({
    name: 'no-empty-test-titles',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description: 'Reports a test or suite with a callback whose title is an empty or blank string.',
            why: 'The title is what a failure report shows. An empty title gives the reader nothing to find the failing test by.',
            fix: 'Name the behavior that the test checks.',
            example: '`it("", run)` reports `empty`. Write `it("adds the tax to the total", run)`.',
        },
        schema: [],
        messages: { empty: 'Replace this empty or blank title with a name for the behavior under test.' },
    },
    create(context) {
        if (!isModuleUsed(context, [...TEST_FRAMEWORK_MODULES])) return {};
        return {
            'CallExpression[arguments.0.type=/^(Literal|TemplateLiteral)$/]'(node: TSESTree.CallExpression) {
                const call = getTestCall(node, context.sourceCode);
                const isRunning = call?.modifiers.every((modifier) => RUNNING_TEST_MODIFIERS.has(modifier)) === true;
                if (!isRunning || call.kind === 'hook' || call.callback === undefined) return;
                const title = node.arguments.find(
                    (argument, index) => index === 0 && ASTUtils.getStringIfConstant(argument)?.trim() === '',
                );
                if (title !== undefined) context.report({ node: title, messageId: 'empty' });
            },
        };
    },
});
