import { tester } from '#plugin-tests/harness/tester.ts';
import { noExportOnlyFiles } from '#plugin/rules/no-export-only-files.ts';

tester().run('no-export-only-files', noExportOnlyFiles, {
    valid: [
        { code: "export * from './a';", filename: '/repo/src/index.ts' },
        { code: "export { a } from './a';\nexport const b = 1;", filename: '/repo/src/b.ts' },
        { code: 'export const b = 1;', filename: '/repo/src/b.ts' },
        { code: "import { a } from './a';\nexport default a;", filename: '/repo/src/b.ts' },
    ],
    invalid: [
        { code: "export * from './a';", filename: '/repo/src/b.ts', errors: [{ messageId: 'exportOnly' }] },
        {
            code: "export { a } from './a';\nexport { c } from './c';",
            filename: '/repo/src/b.ts',
            errors: [{ messageId: 'exportOnly' }],
        },
        {
            code: "import { a } from './a';\nexport { a };",
            filename: '/repo/src/b.ts',
            errors: [{ messageId: 'exportOnly' }],
        },
    ],
});
