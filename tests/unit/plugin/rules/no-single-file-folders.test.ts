import { tester } from '#tests/support/plugin/tester.ts';
import { plantedRoot } from '#tests/support/plugin/planted.ts';
import { noSingleFileFolders } from '#plugin/rules/no-single-file-folders.ts';

const root = await plantedRoot({
    'lone/only.ts': 'export const a = 1;\n',
    'pair/a.ts': '',
    'pair/b.ts': '',
    'component/logic.ts': '',
    'component/View.astro': '<main>Example</main>',
    'schema/parser.ts': '',
    'schema/schema.json': '{}',
    'parent/child/x.ts': '',
    'parent/y.ts': '',
    'typed/one.ts': '',
    'typed/one.d.ts': '',
    'dist/pkg/lone.ts': '',
    'build/pkg/lone.ts': '',
    'coverage/pkg/lone.ts': '',
    'allowed/only.ts': '',
});

tester(root).run('no-single-file-folders', noSingleFileFolders, {
    valid: [
        { code: 'export const a = 1;', filename: `${root}/component/logic.ts` },
        { code: 'export const a = 1;', filename: `${root}/schema/parser.ts` },
        { code: 'export const a = 1;', filename: `${root}/pair/a.ts` },
        { code: 'export const a = 1;', filename: `${root}/parent/y.ts` },
        { code: 'export const a = 1;', filename: `${root}/dist/pkg/lone.ts`, options: [{ ignorePaths: ['dist'] }] },
        { code: 'export const a = 1;', filename: `${root}/allowed/only.ts`, options: [{ allow: ['allowed/**'] }] },
    ],
    invalid: [
        ...['build', 'dist', 'coverage'].map((directory) => ({
            code: 'export const a = 1;',
            filename: `${root}/${directory}/pkg/lone.ts`,
            errors: [{ messageId: 'lone' as const }],
        })),
        {
            code: 'export const a = 1;',
            filename: `${root}/lone/only.ts`,
            errors: [{ messageId: 'lone', data: { name: 'only.ts' } }],
        },
        { code: 'export const a = 1;', filename: `${root}/typed/one.ts`, errors: [{ messageId: 'lone' }] },
    ],
});
