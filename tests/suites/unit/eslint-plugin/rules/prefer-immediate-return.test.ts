import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-immediate-return', plugin.rules['prefer-immediate-return'], {
    valid: [
        'function read() { const result = fetch(); log(result); return result; }',
        'function read() { const result: Response = fetch(); return result; }',
        'function read() { using result = open(); return result; }',
        'function read() { const result = fetch(() => result); return result; }',
        'function read() { const result = fetch(); return transform(result); }',
        'function read() { const result = fetch(); return other; }',
        'function read() { const [result] = fetch(); return result; }',
        'function read() { const result = fetch(); function later() { return result; } return result; }',
    ],
    invalid: [
        {
            code: 'function read(input) { switch (input) { case 1: const result = fetch(); return result; } }',
            errors: [{ messageId: 'immediate', data: { action: 'return' } }],
        },
        {
            code: 'function read() { result = 1; var result = fetch(); return result; }',
            errors: [{ messageId: 'immediate', data: { action: 'return' } }],
        },
        {
            code: 'function read() { const result = fetch(); return result; }',
            errors: [{ messageId: 'immediate', data: { action: 'return' } }],
        },
        {
            code: 'function fail() { const error = new Error("failed"); throw error; }',
            errors: [{ messageId: 'immediate', data: { action: 'throw' } }],
        },
        {
            code: 'async function read() { const result = await fetch(); return result; }',
            errors: [{ messageId: 'immediate', data: { action: 'return' } }],
        },
    ],
});
