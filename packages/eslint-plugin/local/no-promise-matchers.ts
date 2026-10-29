import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { PROMISE_MATCHER_SELECTOR } from './config/no-promise-matchers.ts';

export const noPromiseMatchers = ESLintUtils.RuleCreator.withoutDocs<[], 'promise'>({
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            description:
                'Reports expect().rejects and expect().resolves: Bun types them as returning void, so a missing await passes silently. Await the promise through captureRejection instead.',
        },
        schema: [],
        messages: {
            promise:
                'Await the promise through captureRejection: Bun types this matcher as void, so a missing await passes silently.',
        },
    },
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it to start the rule.
    create(context) {
        return {
            // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it for each matching node.
            [PROMISE_MATCHER_SELECTOR](node: TSESTree.MemberExpression) {
                context.report({ node, messageId: 'promise' });
            },
        };
    },
});
