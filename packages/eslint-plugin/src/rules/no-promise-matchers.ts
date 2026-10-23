import { createRule } from '../create-rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';

export const noPromiseMatchers = createRule<[], 'promise'>({
    name: 'no-promise-matchers',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'none',
            description: 'Reports expect().rejects and expect().resolves in the tests of this repository.',
            why: 'Bun types those matchers as returning void, so neither TypeScript nor ESLint notices a missing await, and the assertion then runs after the test has passed.',
            fix: 'Await the promise through captureRejectedError or captureRejection, then compare the error.',
            example:
                'Write `expect(await captureRejectedError(run())).toMatchObject({ code })` instead of `expect(run()).rejects.toMatchObject({ code })`.',
        },
        schema: [],
        messages: {
            promise:
                'Await the promise through captureRejectedError or captureRejection: Bun types this matcher as void, so a missing await passes silently.',
        },
    },
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it to start the rule.
    create(context) {
        return {
            // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it for each matching node.
            'MemberExpression[property.name=/^(?:rejects|resolves)$/][object.type="CallExpression"][object.callee.name="expect"]'(
                node: TSESTree.MemberExpression,
            ) {
                context.report({ node, messageId: 'promise' });
            },
        };
    },
});
