import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noExclusiveTests } from '#eslint-plugin/rules/testing/no-exclusive-tests.ts';

buildRuleTester().run('no-exclusive-tests', noExclusiveTests, {
    valid: [
        'describe("cart", () => { it("adds", run); });',
        'other.only("adds", run);',
        'test.describe.configure.only("adds", run);',
    ],
    invalid: [
        ...['describe'].map((name) => ({
            code: `${name}.only("adds", run);`,
            errors: [
                {
                    messageId: 'exclusive' as const,
                    suggestions: [{ messageId: 'removeOnly' as const, output: `${name}("adds", run);` }],
                },
            ],
        })),
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
