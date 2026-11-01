import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('test-hooks-first', plugin.rules['test-hooks-first'], {
    valid: [
        'describe("cart", () => { beforeEach(reset); afterEach(clean); it("adds", run); });',
        'describe("cart", () => { beforeEach(reset); it("adds", run); afterEach(clean); afterAll(close); });',
        'describe("cart", () => { beforeEach(reset); });',
        'describe.each([1])("cart", () => { it("adds", run); beforeEach(reset); });',
        'it("adds", run); beforeEach(reset);',
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
            code: 'describe("cart", () => { afterEach(a); it("a", run); afterEach(b); });',
            errors: [{ messageId: 'group', column: 54 }],
        },
        {
            code: 'describe("cart", () => { it("a", run); beforeEach.skip(reset); });',
            errors: [{ messageId: 'before' }],
        },
    ],
});
