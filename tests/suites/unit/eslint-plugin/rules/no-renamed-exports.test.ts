import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';

createRuleTester().run('no-renamed-exports', plugin.rules['no-renamed-exports'], {
    valid: [
        'export const API_URL = process.env.API_URL;',
        'export const API_URL = import.meta.env.API_URL;',
        'export const a = globalThis.settings.name;',
        'export const a = 1;',
        'export const a = build(b);',
        'export const a = { ...b };',
        'const a = b;',
        'export let a = b;',
    ],
    invalid: [
        {
            code: 'import { b } from "./owner"; export const a = b;',
            errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b' } }],
        },
        { code: 'import { b } from "./owner"; export const a = b.c.d;', errors: [{ messageId: 'renamed' }] },
        { code: 'const b = 1; export const a = b as B;', errors: [{ messageId: 'renamed' }] },
        {
            code: 'import { b, d } from "./owner"; export const a = b!, c = d;',
            errors: [{ messageId: 'renamed' }, { messageId: 'renamed' }],
        },
    ],
});
