import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-discarded-postfix', plugin.rules['no-discarded-postfix'], {
    valid: [
        'function read(value) { return ++value; }',
        'function read(value) { return --value; }',
        'function read(value) { return value.count++; }',
        'let count = 0; function read() { return count++; }',
        'function read(count) { if (ready) { return count++; } }',
        'function read(count) { try { return count++; } finally { report(count); } }',
        'function read(count) { return count++ as number; }',
        'const read = (count) => count++;',
        'first = second++;',
        'count = ++count;',
        'value.count = value.count++;',
        'count++;',
    ],
    invalid: [
        'function read(count) { return count++; }',
        'function read(count) { return count--; }',
        'function read() { let count = 0; return count++; }',
        'function read({ count }) { return count++; }',
        'function read(count) { if (ready) return count++; }',
        'function read() { if (ready) { let count = 0; return count++; } }',
        'function read(count) { const observe = () => count; return count++; }',
        'count = count++;',
        'count += count++;',
        'count = count--;',
        'first = count = count++;',
    ].map((code) => ({ code, errors: [{ messageId: 'update' as const }] })),
});
