import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { ALIASES } from '#tests/config/plugin/rules/no-cross-folder-imports.ts';
import { noCrossFolderImports } from '#plugin/rules/no-cross-folder-imports.ts';
import type { CrossFolderImportsOptions } from '#plugin/types/folder-imports.ts';

createRuleTester().run<keyof typeof noCrossFolderImports.meta.messages, [Partial<CrossFolderImportsOptions[0]>]>(
    'no-cross-folder-imports',
    noCrossFolderImports,
    {
        valid: [
            {
                code: "import { b } from '../../user/b';",
                filename: '/repo/packages/shop/source/cart/inner/a.ts',
            },
            { code: "import { b } from '../cart/b';", filename: '/repo/features/cart/a.ts' },
            { code: "import { b } from '../b';", filename: '/repo/features/cart/inner/a.ts' },
            { code: "import { b } from './cart/b';", filename: '/repo/features/main.ts' },
            {
                code: "import { b } from '../cart/b';",
                filename: '/repo/packages/shop/source/cart/a.ts',
            },
            {
                code: "import { a } from './a.js';",
                filename: '/repo/src/turn/b.ts',
                options: [{ aliases: ALIASES }],
            },
            {
                code: "import { a } from '@/turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: ALIASES }],
            },
        ],
        invalid: [
            {
                code: "import { a } from '../a.js';",
                filename: '/repo/scripts/inner/b.ts',
                options: [{ aliases: ALIASES }],
                errors: [{ messageId: 'escape' }],
            },
            {
                code: "import { b } from '../../tests/b';",
                filename: '/repo/features/cart/a.ts',
                errors: [{ messageId: 'escape', data: { source: '../../tests/b', folder: 'cart' } }],
            },
            {
                code: "import { b } from '../user/b';",
                filename: '/repo/features/cart/a.ts',
                errors: [{ messageId: 'escape', data: { source: '../user/b', folder: 'cart' } }],
            },
            {
                code: "import { b } from '../user/b';",
                filename: '/repo/features/cart/a.ts',
                errors: [{ messageId: 'escape' }],
            },

            {
                code: "import { a } from '../turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: ALIASES }],
                output: "import { a } from '@/turn/a.js';",
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                code: 'import { a } from "../../config/a.js";',
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: ALIASES }],
                output: 'import { a } from "@config/a.js";',
                errors: [{ messageId: 'alias' }],
            },
            {
                code: "import { a } from '../a.js';",
                filename: '/repo/lib/inner/b.ts',
                options: [{ aliases: ALIASES }],
                errors: [{ messageId: 'escape' }],
            },
        ],
    },
);

// A Windows checkout names the file with backslashes and may spell the drive letter of the root in another case.
createRuleTester(String.raw`c:\repo`).run<
    keyof typeof noCrossFolderImports.meta.messages,
    [Partial<CrossFolderImportsOptions[0]>]
>('no-cross-folder-imports on Windows paths', noCrossFolderImports, {
    valid: [{ code: "import { b } from '../cart/b';", filename: String.raw`C:\repo\features\cart\a.ts` }],
    invalid: [
        {
            code: "import { b } from '../user/b';",
            filename: String.raw`C:\repo\features\cart\a.ts`,
            errors: [{ messageId: 'escape', data: { source: '../user/b', folder: 'cart' } }],
        },
    ],
});
