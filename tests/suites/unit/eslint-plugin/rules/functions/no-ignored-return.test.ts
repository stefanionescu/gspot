import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noIgnoredReturn } from '#eslint-plugin/rules/functions/no-ignored-return.ts';

buildTypedRuleTester().run('no-ignored-return', noIgnoredReturn, {
    valid: [
        'declare const names: string[]; names.push("a");',
        'declare const title: string; title.replace("a", () => { count(); return ""; });',
        'declare const names: string[]; let found; names.find((name) => { found = name; });',
        'declare const title: string; const upper = title.toUpperCase();',
    ],
    invalid: [
        {
            code: 'declare const title: string; title.trim();',
            errors: [{ messageId: 'ignored', data: { method: 'trim' } }],
        },
        { code: 'declare const names: string[]; names.map((name) => name);', errors: [{ messageId: 'map' }] },
        { code: 'Math.max(1, 2);', errors: [{ messageId: 'ignored', data: { method: 'max' } }] },
        {
            code: 'declare const total: number; total.toFixed(2);',
            errors: [{ messageId: 'ignored', data: { method: 'toFixed' } }],
        },
        {
            code: 'declare const title: string; title.replace("a", "b");',
            errors: [{ messageId: 'ignored', data: { method: 'replace' } }],
        },
        {
            code: 'const list = [1];\nlet total = 0;\nlist.find((item) => { const save = () => { total = item; }; return save(); });',
            errors: [{ messageId: 'ignored', data: { method: 'find' } }],
        },
    ],
});
