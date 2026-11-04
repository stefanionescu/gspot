import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noDiscardedPostfix } from '#eslint-plugin/rules/variables/no-discarded-postfix.ts';

buildRuleTester().run('no-discarded-postfix', noDiscardedPostfix, {
    valid: [
        'function read(value) { return ++value; }',
        'function read(value) { return value.count++; }',
        'let count = 0; function read() { return count++; }',
        'function read(count) { if (ready) { return count++; } }',
        'function read(count) { return count++ as number; }',
        'first = second++;',
    ],
    invalid: ['function read(count) { return count++; }', 'count = count++;'].map((code) => ({
        code,
        errors: [{ messageId: 'update' as const }],
    })),
});
