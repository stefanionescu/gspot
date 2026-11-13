import { testHooksFirst } from '#eslint-plugin/rules/testing/test-hooks-first.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('test-hooks-first', testHooksFirst, {
    valid: [
        'describe("cart", () => { beforeEach(reset); afterEach(clean); it("adds", run); });',
        'describe("cart", () => { beforeEach(reset); it("adds", run); afterEach(clean); afterAll(close); });',
        'describe("cart", () => { beforeEach(reset); afterEach(clean); });',
        'describe("cart", () => { const user = build(); setup(user); beforeEach(reset); it("adds", run); });',
        'describe("cart", () => { expect(total).toBe(1); it.only("adds", run); });',
    ],
    invalid: [
        {
            code: 'describe("cart", () => { it("adds", run); beforeEach(reset); });',
            errors: [{ messageId: 'before', column: 43 }],
        },
        {
            code: 'context.only("cart", () => { it("a", run); after(clean); describe("b", run); });',
            errors: [{ messageId: 'after' }],
        },
        {
            code: 'describe("cart", () => { afterEach(a); it("a", run); afterEach(b); afterAll(c); });',
            errors: [{ messageId: 'group', column: 26 }],
        },
        {
            code: 'describe("cart", () => { it("a", run); beforeEach.skip(reset); });',
            errors: [{ messageId: 'before', column: 40, endColumn: 50 }],
        },
    ],
});
