import { preferImmediateReturn } from '#eslint-plugin/rules/variables/prefer-immediate-return.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-immediate-return', preferImmediateReturn, {
    valid: [
        'function read() { const result = fetch(); log(result); return result; }',
        'function read() { const result: Response = fetch(); return result; }',
        'function read() { const result = fetch(); return transform(result); }',
        'function read() { const result = fetch(); return other; }',
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
            code: 'function fail() { const error = new Error("failed"); throw error; }',
            errors: [{ messageId: 'immediate', data: { action: 'throw' } }],
        },
    ],
});
