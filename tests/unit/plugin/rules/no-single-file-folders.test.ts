import { tester } from '#tests/support/plugin/tester.ts';
import { plantedRoot } from '#tests/support/plugin/planted.ts';
import { noSingleFileFolders } from '#plugin/rules/no-single-file-folders.ts';

const root = await plantedRoot({
    'lone/only.ts': 'export const a = 1;\n',
    'pair/a.ts': '',
    'pair/b.ts': '',
    'parent/child/x.ts': '',
    'parent/y.ts': '',
    'typed/one.ts': '',
    'typed/one.d.ts': '',
    'dist/pkg/lone.ts': '',
    'allowed/only.ts': '',
});

tester(root).run('no-single-file-folders', noSingleFileFolders, {
    valid: [
        { code: 'export const a = 1;', filename: `${root}/pair/a.ts` },
        { code: 'export const a = 1;', filename: `${root}/parent/y.ts` },
        { code: 'export const a = 1;', filename: `${root}/dist/pkg/lone.ts` },
        { code: 'export const a = 1;', filename: `${root}/allowed/only.ts`, options: [{ allow: ['allowed/**'] }] },
    ],
    invalid: [
        {
            code: 'export const a = 1;',
            filename: `${root}/lone/only.ts`,
            errors: [{ messageId: 'lone', data: { name: 'only.ts' } }],
        },
        { code: 'export const a = 1;', filename: `${root}/typed/one.ts`, errors: [{ messageId: 'lone' }] },
    ],
});
