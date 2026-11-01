import { createRule } from '../rule.ts';
import { usesModule } from '../packages.ts';
import { readTestCall } from '../testing.ts';
import { ASTUtils, type TSESTree } from '@typescript-eslint/utils';
import { TEST_FRAMEWORK_MODULES, RUNNING_TEST_MODIFIERS } from '../config/testing.ts';

export const noEmptyTestTitles = createRule<[], 'empty'>({
    name: 'no-empty-test-titles',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a test or suite with a callback whose title is an empty or blank string, in files that import a test framework or whose package.json depends on one: Mocha, Jest, Vitest, Bun, node:test, or Playwright. Parameterized and skipped tests are not checked.',
            why: 'The title is what a failure report shows. An empty title gives the reader nothing to find the failing test by.',
            fix: 'Name the behavior that the test checks.',
            example: '`it("", run)` reports `empty`. Write `it("adds the tax to the total", run)`.',
        },
        schema: [],
        messages: { empty: 'Replace this empty or blank title with a name for the behavior under test.' },
    },
    create(context) {
        if (!usesModule(context, [...TEST_FRAMEWORK_MODULES])) return {};
        return {
            'CallExpression[arguments.0.type=/^(Literal|TemplateLiteral)$/]'(node: TSESTree.CallExpression) {
                const call = readTestCall(node, context.sourceCode);
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
