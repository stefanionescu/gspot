import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noNestedFunctions } from '#eslint-plugin/rules/functions/no-nested-functions.ts';

buildRuleTester().run('no-nested-functions', noNestedFunctions, {
    valid: [
        'function a() { function b() { function c() { function d() { function e() {} } } } }',
        'describe("a", () => { it("b", () => { function c() { function d() { function e() { function f() { function g() {} } } } } }); });',
        { code: 'function a() { function b() {} }', options: [{ threshold: 2 }] },
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
