import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-empty-return-value', plugin.rules['no-empty-return-value'], {
    valid: [
        'function write() { save(); } write();',
        'function write() { save(); } function invoke() { return write(); }',
        'function write() { save(); } ready && write();',
        'function write() { save(); } ready ? write() : other;',
        'function write() { save(); } (write(), other);',
        'function read() {} const value = read();',
        'async function read() { save(); } const value = read();',
        'function* read() { save(); } const value = read();',
        'function read() { if (ready) return value; } const value = read();',
        'const read = () => save(); const value = read();',
        'declare function read(): number; const value = read();',
        'function read() { save(); } const alias = read; const value = alias();',
        'import read from "reader"; const value = read();',
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
