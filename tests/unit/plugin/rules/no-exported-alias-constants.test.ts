import { tester } from '#tests/support/plugin/tester.ts';
import { noExportedAliasConstants } from '#plugin/rules/no-exported-alias-constants.ts';

tester().run('no-exported-alias-constants', noExportedAliasConstants, {
    valid: [
        'export const a = 1;',
        'export const a = build(b);',
        'export const a = { ...b };',
        'const a = b;',
        'export let a = b;',
        'export const a = b();',
    ],
    invalid: [
        { code: 'export const a = b;', errors: [{ messageId: 'alias', data: { name: 'a', source: 'b' } }] },
        { code: 'export const a = b.c.d;', errors: [{ messageId: 'alias' }] },
        { code: 'export const a = b as B;', errors: [{ messageId: 'alias' }] },
        { code: 'export const a = b!, c = d;', errors: [{ messageId: 'alias' }, { messageId: 'alias' }] },
    ],
});
