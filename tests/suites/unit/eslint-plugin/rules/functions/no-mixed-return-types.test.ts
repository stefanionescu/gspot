import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noMixedReturnTypes } from '#eslint-plugin/rules/functions/no-mixed-return-types.ts';

const rule = noMixedReturnTypes;

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
        "type Result = { id: string } & ({ kind: 'a' } | { kind: 'b'; note: string }); declare const made: Result; function read(raw: boolean): Result { if (raw) return { id: '1', kind: 'a' }; return made; }",
        "function pick(raw: boolean) { if (raw) return ['a', 1] as const; return ['b']; }",
        "function pick<T extends string>(raw: boolean, name: T) { if (raw) return name; return 'x'; }",
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
        {
            code: 'async function read(raw: boolean) { if (raw) return "1"; return 1; }',
            errors: [{ messageId: 'mixed' }],
        },
    ],
});
