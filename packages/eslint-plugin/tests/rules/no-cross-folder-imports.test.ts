import { tester } from '#plugin-tests/harness/tester.ts';
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
            options: [{ scope: ['packages/shop/source'] }],
        },
        { code: "import { a } from './a.js';", filename: '/repo/src/turn/b.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/a.js';", filename: '/repo/src/other/b.ts', options: [{ aliases }] },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/scripts/inner/b.ts',
            options: [{ aliases, scope: ['src'] }],
        },
    ],
    invalid: [
        {
            code: "import { b } from '../../tests/b';",
            filename: '/repo/features/cart/a.ts',
            options: [{ scope: ['.'] }],
            errors: [{ messageId: 'crossNoAlias', data: { source: '../../tests/b', folder: 'features' } }],
        },
        {
            code: "import { b } from '../user/b';",
            filename: '/repo/features/cart/a.ts',
            errors: [{ messageId: 'crossNoAlias', data: { source: '../user/b', folder: 'cart' } }],
        },
        {
            code: "import { b } from './inner/../../user/b';",
            filename: '/repo/features/cart/a.ts',
            errors: [{ messageId: 'crossNoAlias' }],
        },
        {
            code: "import { b } from '../../user/b';",
            filename: '/repo/packages/shop/source/cart/inner/a.ts',
            options: [{ scope: ['packages/shop/source'] }],
            errors: [{ messageId: 'crossNoAlias' }],
        },
        {
            code: "import { a } from '../turn/a.js';",
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: "import { a } from '@/turn/a.js';",
            errors: [{ messageId: 'cross', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
        },
        {
            code: 'import { a } from "../../config/a.js";',
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: 'import { a } from "@config/a.js";',
            errors: [{ messageId: 'cross' }],
        },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/lib/inner/b.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'crossNoAlias' }],
        },
    ],
});
