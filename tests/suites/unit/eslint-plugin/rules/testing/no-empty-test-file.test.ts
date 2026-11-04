import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noEmptyTestFile } from '#eslint-plugin/rules/testing/no-empty-test-file.ts';

buildRuleTester().run('no-empty-test-file', noEmptyTestFile, {
    valid: [
        { code: 'export const value = 1;', filename: 'cart.ts' },
        { code: 'test("adds", run);', filename: 'cart.test.ts' },
        { code: 'it.concurrent.only.each([1])("adds", run);', filename: 'cart.spec.js' },
        { code: 'test.each`a | b`("adds", run);', filename: 'cart.test.ts' },
        { code: 'test.skip("adds", run);', filename: 'cart.cy.ts' },
        { code: 'ruleTester.run("rule", rule, cases);', filename: 'rule.test.ts' },
        { code: 'buildRuleTester().run("rule", rule, { valid: [], invalid: [] });', filename: 'rule.test.ts' },
        { code: 'Deno.test("adds", run);', filename: 'cart.test.mts' },
    ],
    invalid: [
        { code: 'export const value = 1;', filename: 'cart.test.ts', errors: [{ messageId: 'empty', line: 1 }] },
        { code: 'describe("cart", () => {});', filename: 'cart.spec.tsx', errors: [{ messageId: 'empty' }] },
        { code: 'test.skip(isMobile);', filename: 'cart.cy.js', errors: [{ messageId: 'empty' }] },
        { code: 'test.describe("cart", run);', filename: 'cart.test.ts', errors: [{ messageId: 'empty' }] },
        { code: 'startServer().run("build");', filename: 'server.test.ts', errors: [{ messageId: 'empty' }] },
    ],
});
