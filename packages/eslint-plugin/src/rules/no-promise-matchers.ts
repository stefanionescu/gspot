import { createRule } from '../schemas/rules/options.ts';
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
    create(context) {
        return {
            'MemberExpression[property.name=/^(?:rejects|resolves)$/][object.type="CallExpression"][object.callee.name="expect"]'(
                node: TSESTree.MemberExpression,
            ) {
                context.report({ node, messageId: 'promise' });
            },
        };
    },
});
