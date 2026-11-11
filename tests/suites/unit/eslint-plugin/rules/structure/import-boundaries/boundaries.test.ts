import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';
import { importBoundaries } from '#eslint-plugin/rules/structure/import-boundaries.ts';
import type { ImportBoundariesOptions } from '#eslint-plugin/types/structure.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const IMPORT_ALIASES = { '@/*': 'src/*', '@config/*': 'config/*' } as const;

const PROJECT_FOLDERS = ['api', 'supabase'];

buildRuleTester().run<keyof (typeof importBoundaries)['meta']['messages'], [Partial<ImportBoundariesOptions[0]>]>(
    'import-boundaries',
    importBoundaries,
    {
        valid: [
            {
                name: 'external script allowed by externals',
                code: "import { app } from '../../scripts/app.js';",
                filename: '/repo/web/src/a.ts',
                options: [{ externals: ['../../scripts/app.js'] }],
            },
            {
                code: "import { b } from '../../user/b';",
                filename: '/repo/packages/shop/source/cart/inner/a.ts',
            },
            { code: "import { b } from './cart/b';", filename: '/repo/features/main.ts' },
            {
                code: "import { a } from '../src-other/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: ['api'] }],
            },
            {
                code: "import { a } from '../cart';",
                filename: '/repo/features/cart/a.ts',
            },
            {
                code: "import { a } from '../../src/a.js';",
                filename: '/repo/features/cart/b.ts',
                options: [{ folders: ['.'] }],
            },
        ],
        invalid: [
            {
                name: 'exact alias cannot represent a child module',
                code: "import { a } from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '@lib': 'src/lib' } }],
                output: null,
                errors: [{ messageId: 'escape' }],
            },
            {
                name: 'suffix wildcard alias represents a child module',
                code: "import { a } from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '#lib/*.js': 'src/lib/*.js' } }],
                output: "import { a } from '#lib/a.js';",
                errors: [{ messageId: 'alias' }],
            },
            {
                code: "import metadata from '../../package.json';",
                filename: '/repo/packages/cli/src/main.ts',
                options: [{ aliases: { '#cli-package': 'packages/package.json' } }],
                output: "import metadata from '#cli-package';",
                errors: [{ messageId: 'alias' }],
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
                name: 'sibling feature import on POSIX',
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
                code: 'import(`../turn/a.js`);',
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: IMPORT_ALIASES }],
                output: null,
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                code: "export { a } from '../../supabase/src/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: PROJECT_FOLDERS }],
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
                code: "export * from '../../ios/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: PROJECT_FOLDERS }],
                errors: [{ messageId: 'escape' }],
            },
        ],
    },
);

buildRuleTester({ root: String.raw`c:\repo` }).run<
    keyof (typeof importBoundaries)['meta']['messages'],
    [Partial<ImportBoundariesOptions[0]>]
>('import-boundaries on Windows paths', importBoundaries, {
    valid: [],
    invalid: [
        {
            name: 'sibling feature import on Windows',
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

test('boundary folders start at the ESLint cwd when no root is set', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        { files: ['**/*.ts'], plugins: { gspot: plugin }, rules: { 'gspot/import-boundaries': 'error' } },
    ];
    const findings = linter.verify("import { b } from '../user/b';", config, { filename: '/repo/features/cart/a.ts' });
    expect(findings.map(({ ruleId, messageId }) => ({ ruleId, messageId }))).toStrictEqual([
        { ruleId: 'gspot/import-boundaries', messageId: 'escape' },
    ]);
});
