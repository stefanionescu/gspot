import { noExclusiveTests } from '#eslint-plugin/rules/testing/no-exclusive-tests.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-exclusive-tests', noExclusiveTests, {
    valid: [
        'describe("cart", () => { it("adds", run); });',
        'other.only("adds", run);',
        'test.describe.configure.only("adds", run);',
    ],
    invalid: [
        {
            code: 'it.only("adds", run);',
            errors: [
                { messageId: 'exclusive', suggestions: [{ messageId: 'removeOnly', output: 'it("adds", run);' }] },
            ],
        },
        {
            code: 'describe.only("cart", run);',
            errors: [
                {
                    messageId: 'exclusive',
                    suggestions: [{ messageId: 'removeOnly', output: 'describe("cart", run);' }],
                },
            ],
        },
        {
            code: 'test.describe.parallel.only("cart", run);',
            errors: [
                {
                    messageId: 'exclusive',
                    suggestions: [{ messageId: 'removeOnly', output: 'test.describe.parallel("cart", run);' }],
                },
            ],
        },
        {
            code: 'test.describe . only("cart", run);',
            errors: [
                {
                    messageId: 'exclusive',
                    suggestions: [{ messageId: 'removeOnly', output: 'test.describe("cart", run);' }],
                },
            ],
        },
    ],
});
