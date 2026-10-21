import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';

createRuleTester().run('no-renamed-exports', plugin.rules['no-renamed-exports'], {
    valid: [
        'export const a = 1;',
        'export const a = build(b);',
        'export const a = { ...b };',
        'const a = b;',
        'export let a = b;',
    ],
    invalid: [
        { code: 'export const a = b;', errors: [{ messageId: 'renamed', data: { name: 'a', source: 'b' } }] },
        { code: 'export const a = b.c.d;', errors: [{ messageId: 'renamed' }] },
        { code: 'export const a = b as B;', errors: [{ messageId: 'renamed' }] },
        { code: 'export const a = b!, c = d;', errors: [{ messageId: 'renamed' }, { messageId: 'renamed' }] },
    ],
});
