import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noEmptyReturnValue } from '#eslint-plugin/rules/functions/no-empty-return-value.ts';

buildRuleTester().run('no-empty-return-value', noEmptyReturnValue, {
    valid: [
        'function write() { save(); } write();',
        'function write() { save(); } ready && write();',
        'function write() { save(); } ready ? write() : other;',
        'function write() { save(); } (write(), other);',
        'function read() {} const value = read();',
        'async function read() { save(); } const value = read();',
        'function* read() { save(); } const value = read();',
        'function read() { if (ready) return value; } const value = read();',
        'const read = () => save(); const value = read();',
        'declare function read(): number; const value = read();',
        'function run(callback: () => number) { const value = callback(); consume(value); }',
    ],
    invalid: [
        { code: 'function write() { save(); } const value = write();', errors: [{ messageId: 'return' }] },
        { code: 'function write() { return; } const value = write();', errors: [{ messageId: 'return' }] },
        { code: 'const write = () => { save(); }; const value = write();', errors: [{ messageId: 'return' }] },
        { code: 'function write() { save(); } write() && ready;', errors: [{ messageId: 'return' }] },
        { code: 'function write() { save(); } write() ? first : second;', errors: [{ messageId: 'return' }] },
        { code: 'function write() { save(); } const value = (other, write());', errors: [{ messageId: 'return' }] },
        {
            code: 'function write() { function nested() { return 1; } save(); } const value = write();',
            errors: [{ messageId: 'return' }],
        },
        { code: 'declare function write(): void; const value = write();', errors: [{ messageId: 'return' }] },
    ],
});
