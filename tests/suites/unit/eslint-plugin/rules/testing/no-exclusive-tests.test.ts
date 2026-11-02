import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-exclusive-tests', plugin.rules['no-exclusive-tests'], {
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
