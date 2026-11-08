import { noInvertedAssertions } from '#eslint-plugin/rules/assertions/no-inverted-assertions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-inverted-assertions', noInvertedAssertions, {
    valid: [
        'it("adds", () => { assert.equal(total, 3); });',
        'assert.equal(3, total);',
        'it("adds", () => { assert.equal(3, 4); });',
        'it("adds", () => { assert.ok(3, total); });',
        'describe("cart", () => { assert.equal(3, total); });',
    ],
    invalid: [
        {
            code: 'it("adds", () => { assert.strictEqual(3, total); });',
            errors: [
                {
                    messageId: 'swap',
                    data: { format: 'assert.strictEqual(actual, expected)' },
                    column: 42,
                    suggestions: [
                        { messageId: 'swapArguments', output: 'it("adds", () => { assert.strictEqual(total, 3); });' },
                    ],
                },
            ],
        },
        {
            code: 'test.only("adds", () => { expect("3").to.not.eql(total); });',
            errors: [
                {
                    messageId: 'swap',
                    data: { format: 'expect(actual).to.eql(expected)' },
                    suggestions: [
                        {
                            messageId: 'swapArguments',
                            output: 'test.only("adds", () => { expect(total).to.not.eql("3"); });',
                        },
                    ],
                },
            ],
        },
    ],
});
