import { tester } from '#tests/harness/plugin/tester.ts';
import { noCrossFolderImports } from '#plugin/rules/no-cross-folder-imports.ts';

const aliases = { '@/': 'src/', '@config/': 'config/', '@tests/': 'tests/' };

tester().run('no-cross-folder-imports', noCrossFolderImports, {
    valid: [
        { code: "import { b } from '../cart/b';", filename: '/repo/features/cart/a.ts' },
        { code: "import { b } from '../b';", filename: '/repo/features/cart/inner/a.ts' },
        { code: "import { b } from './cart/b';", filename: '/repo/features/main.ts' },
        {
            code: "import { b } from '../cart/b';",
            filename: '/repo/packages/shop/source/cart/a.ts',
            options: [{ roots: ['packages/shop/source'] }],
        },
        { code: "import { a } from './a.js';", filename: '/repo/src/turn/b.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/a.js';", filename: '/repo/src/other/b.ts', options: [{ aliases }] },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/scripts/inner/b.ts',
            options: [{ aliases, roots: ['src'] }],
        },
    ],
    invalid: [
        {
            code: "import { b } from '../../tests/b';",
            filename: '/repo/features/cart/a.ts',
            options: [{ roots: ['.'] }],
            errors: [{ messageId: 'escape', data: { source: '../../tests/b', folder: 'features' } }],
        },
        {
            code: "import { b } from '../user/b';",
            filename: '/repo/features/cart/a.ts',
            errors: [{ messageId: 'escape', data: { source: '../user/b', folder: 'cart' } }],
        },
        {
            code: "import { b } from './inner/../../user/b';",
            filename: '/repo/features/cart/a.ts',
            errors: [{ messageId: 'escape' }],
        },
        {
            code: "import { b } from '../../user/b';",
            filename: '/repo/packages/shop/source/cart/inner/a.ts',
            options: [{ roots: ['packages/shop/source'] }],
            errors: [{ messageId: 'escape' }],
        },
        {
            code: "import { a } from '../turn/a.js';",
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: "import { a } from '@/turn/a.js';",
            errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
        },
        {
            code: 'import { a } from "../../config/a.js";',
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: 'import { a } from "@config/a.js";',
            errors: [{ messageId: 'alias' }],
        },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/lib/inner/b.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'escape' }],
        },
    ],
});

// A Windows checkout names the file with backslashes and may spell the drive letter of the root in another case.
tester(String.raw`c:\repo`).run('no-cross-folder-imports on Windows paths', noCrossFolderImports, {
    valid: [{ code: "import { b } from '../cart/b';", filename: String.raw`C:\repo\features\cart\a.ts` }],
    invalid: [
        {
            code: "import { b } from '../user/b';",
            filename: String.raw`C:\repo\features\cart\a.ts`,
            errors: [{ messageId: 'escape', data: { source: '../user/b', folder: 'cart' } }],
        },
    ],
});
