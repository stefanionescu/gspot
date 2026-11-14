import { noNestedFunctions } from '#eslint-plugin/rules/functions/no-nested-functions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-nested-functions', noNestedFunctions, {
    valid: [
        'function a() { function b() { function c() { function d() { function e() {} } } } }',
        'describe.skip("a", () => { it("b", () => { function c() { function d() { function e() { function f() { function g() {} } } } } }); });',
        { code: 'test.describe.parallel("cart", () => { const total = () => 1; });', options: [{ threshold: 1 }] },
        { code: 'describe.each([1])("cart %i", () => { const total = () => 1; });', options: [{ threshold: 1 }] },
        {
            code: 'import { test as base } from "@playwright/test";\nconst test = base.extend({});\ntest.describe("cart", () => { const total = () => 1; });',
            options: [{ threshold: 1 }],
        },
    ],
    invalid: [
        {
            code: 'function a() { function b() { function c() { function d() { function e() { const f = () => 1; } } } } }',
            errors: [{ messageId: 'nested', data: { threshold: 5 } }],
        },
        {
            code: 'function a() { function b() { function c() {} } }',
            options: [{ threshold: 2 }],
            errors: [{ messageId: 'nested', data: { threshold: 2 } }],
        },
    ],
});
