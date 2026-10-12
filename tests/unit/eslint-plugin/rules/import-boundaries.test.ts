import plugin from '#eslint-plugin/plugin.ts';
import type { Options } from '#tests/types/eslint-plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';
import { FOLDERS, IMPORT_ALIASES } from '#tests/config/eslint-plugin.ts';

createRuleTester().run<keyof (typeof plugin.rules)['import-boundaries']['meta']['messages'], Options>(
    'import-boundaries',
    plugin.rules['import-boundaries'],
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
                options: [{ aliases: IMPORT_ALIASES }],
            },
            {
                code: "import { a } from '@/turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
            },
            {
                code: "import { a } from '../src-other/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: ['api'] }],
            },
            {
                code: "import { a } from '../../supabase/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: [] }],
            },
            {
                code: "import { a } from '../cart';",
                filename: '/repo/features/cart/a.ts',
            },
            {
                code: "import { a } from './src/a.js';",
                filename: '/repo/main.ts',
                options: [{ folders: ['.'] }],
            },
            {
                code: "import { a } from '../../src/a.js';",
                filename: '/repo/features/cart/b.ts',
                options: [{ folders: ['.'] }],
            },
            {
                code: "import { a } from './a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
            },
            {
                code: "import { a } from '../types/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
            },
            {
                code: "import { a } from '../../supabase/a.js';",
                filename: '/repo/root/src/b.ts',
                options: [{ folders: FOLDERS }],
            },
            {
                code: "import { a } from './a.js';",
                filename: '/repo/apps/api/src/b.ts',
                options: [{ folders: ['apps', 'apps/api', 'services/db'] }],
            },
        ],
        invalid: [
            {
                code: "import { a } from '../a.js';",
                filename: '/repo/scripts/inner/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
                errors: [{ messageId: 'escape' }],
            },
            {
                code: "import { b } from '../../tests/b';",
                filename: '/repo/features/cart/a.ts',
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../tests/b', folder: 'features/cart', target: 'tests/b' },
                    },
                ],
            },
            {
                code: "import { b } from '../user/b';",
                filename: '/repo/features/cart/a.ts',
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../user/b', folder: 'features/cart', target: 'features/user' },
                    },
                ],
            },
            {
                code: "import { a } from '../turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
                output: "import { a } from '@/turn/a.js';",
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                code: 'import { a } from "../../config/a.js";',
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
                output: 'import { a } from "@config/a.js";',
                errors: [{ messageId: 'alias' }],
            },
            {
                code: "import { a } from '../../other/a.js';",
                filename: '/repo/apps/api/src/b.ts',
                options: [{ folders: ['apps', 'apps/api'] }],
                errors: [
                    { messageId: 'escape', data: { source: '../../other/a.js', folder: 'apps/api', target: 'apps' } },
                ],
            },
            {
                code: 'import(`../../supabase/src/a.js`);',
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../supabase/src/a.js', folder: 'api', target: 'supabase' },
                    },
                ],
            },
            {
                code: 'import(`../turn/a.js`);',
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
                output: null,
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                code: "export { a } from '../../supabase/src/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
                errors: [{ messageId: 'escape' }],
            },
            {
                code: "import { a } from '../outside/a.js';",
                filename: '/repo/main.ts',
                options: [{ folders: ['.'] }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../outside/a.js', folder: '.', target: '../outside/a.js' },
                    },
                ],
            },
            {
                code: "import { a } from '../../quality/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../quality/a.js', folder: 'api', target: 'quality/a.js' },
                    },
                ],
            },
            {
                code: "import { a } from '../../../services/db/src/a.js';",
                filename: '/repo/apps/api/src/b.ts',
                options: [{ folders: ['apps', 'apps/api', 'services/db'] }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../../services/db/src/a.js', folder: 'apps/api', target: 'services/db' },
                    },
                ],
            },
            {
                code: "import { a } from '../../supabase/src/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../supabase/src/a.js', folder: 'api', target: 'supabase' },
                    },
                ],
            },
            {
                code: "export * from '../../ios/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: FOLDERS }],
                errors: [{ messageId: 'escape' }],
            },
        ],
    },
);

// Windows paths can use backslashes and a different drive-letter case.
createRuleTester(String.raw`c:\repo`).run<
    keyof (typeof plugin.rules)['import-boundaries']['meta']['messages'],
    Options
>('import-boundaries on Windows paths', plugin.rules['import-boundaries'], {
    valid: [{ code: "import { b } from '../cart/b';", filename: String.raw`C:\repo\features\cart\a.ts` }],
    invalid: [
        {
            code: "import { b } from '../user/b';",
            filename: String.raw`C:\repo\features\cart\a.ts`,
            errors: [
                {
                    messageId: 'escape',
                    data: { source: '../user/b', folder: 'features/cart', target: 'features/user' },
                },
            ],
        },
    ],
});
