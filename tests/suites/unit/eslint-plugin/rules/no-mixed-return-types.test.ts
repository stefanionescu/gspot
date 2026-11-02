import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const rule = plugin.rules['no-mixed-return-types'];

buildRuleTester().run('no-mixed-return-types', rule, {
    valid: ['function read(raw) { if (raw) return "1"; return 1; }'],
    invalid: [],
});

buildTypedRuleTester().run('no-mixed-return-types', rule, {
    valid: [
        'function read(raw: boolean) { if (raw) return "1"; return "2"; }',
        'function read(raw: boolean) { if (raw) return "1"; return null; }',
        'function check(raw: boolean) { if (raw) return "invalid"; return true; }',
        '/** @returns the value */\nfunction read(raw: boolean) { if (raw) return "1"; return 1; }',
        'class Builder { add(raw: boolean) { if (raw) return this; return 1; } }',
    ],
    invalid: [
        {
            code: 'function read(raw: boolean) { if (raw) return "1"; return 1; }',
            errors: [{ messageId: 'mixed', column: 10, endColumn: 14 }],
        },
        {
            code: 'const read = (raw: boolean) => { if (raw) return [1]; return { value: 1 }; };',
            errors: [{ messageId: 'mixed', column: 29 }],
        },
        {
            code: 'class Reader { read(raw: boolean) { if (raw) return () => 1; return new Date(); } }',
            errors: [{ messageId: 'mixed', column: 16 }],
        },
        {
            code: 'function read(raw: boolean, value: string | number) { if (raw) return value; return [1]; }',
            errors: [{ messageId: 'mixed', column: 10 }],
        },
        {
            code: 'function read(raw: boolean, ready: boolean) { if (raw) return "1"; if (ready) return 1; return null; }',
            errors: [{ messageId: 'mixed', column: 10 }],
        },
    ],
});
