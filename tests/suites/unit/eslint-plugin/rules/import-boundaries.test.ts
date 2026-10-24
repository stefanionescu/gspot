import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { ImportBoundariesOptions } from '#eslint-plugin/types/rules.ts';
import { IMPORT_ALIASES, PROJECT_FOLDERS } from '#tests/config/eslint-plugin/import-boundaries.ts';

createRuleTester().run<
    keyof (typeof plugin.rules)['import-boundaries']['meta']['messages'],
    [Partial<ImportBoundariesOptions[0]>]
>('import-boundaries', plugin.rules['import-boundaries'], {
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
        {
            name: 'sibling within the root feature folder',
            code: "import { b } from '../cart/b';",
            filename: '/repo/features/cart/a.ts',
        },
        { code: "import { b } from '../b';", filename: '/repo/features/cart/inner/a.ts' },
        { code: "import { b } from './cart/b';", filename: '/repo/features/main.ts' },
        {
            name: 'sibling within the package feature folder',
            code: "import { b } from '../cart/b';",
            filename: '/repo/packages/shop/source/cart/a.ts',
        },
        {
            name: 'relative import within an aliased feature',
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
            name: 'parent import with no configured boundaries',
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
            name: 'relative import within a declared project',
            code: "import { a } from './a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }],
        },
        {
            code: "import { a } from '../types/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }],
        },
        {
            name: 'parent import across declared project boundaries',
            code: "import { a } from '../../supabase/a.js';",
            filename: '/repo/root/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }],
        },
        {
            name: 'relative import within a nested declared project',
            code: "import { a } from './a.js';",
            filename: '/repo/apps/api/src/b.ts',
            options: [{ folders: ['apps', 'apps/api', 'services/db'] }],
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
            name: 'external script without externals',
            code: "import { app } from '../../scripts/app.js';",
            filename: '/repo/web/src/a.ts',
            errors: [{ messageId: 'escape' }],
        },
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
            errors: [{ messageId: 'escape', data: { source: '../../other/a.js', folder: 'apps/api', target: 'apps' } }],
        },
        ...['import(`../../supabase/src/a.js`);', "import { a } from '../../supabase/src/a.js';"].map((code) => ({
            code,
            filename: '/repo/api/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }] satisfies [Partial<ImportBoundariesOptions[0]>],
            errors: [
                {
                    messageId: 'escape' as const,
                    data: { source: '../../supabase/src/a.js', folder: 'api', target: 'supabase' },
                },
            ],
        })),
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
            code: "import { a } from '../../quality/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }],
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
            code: "export * from '../../ios/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ folders: PROJECT_FOLDERS }],
            errors: [{ messageId: 'escape' }],
        },
    ],
});

createRuleTester({ root: String.raw`c:\repo` }).run<
    keyof (typeof plugin.rules)['import-boundaries']['meta']['messages'],
    [Partial<ImportBoundariesOptions[0]>]
>('import-boundaries on Windows paths', plugin.rules['import-boundaries'], {
    valid: [
        {
            name: 'sibling within a Windows feature folder',
            code: "import { b } from '../cart/b';",
            filename: String.raw`C:\repo\features\cart\a.ts`,
        },
    ],
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

test('a relative import that leaves its folder reports escape against the ESLint working folder when no root is set', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        { files: ['**/*.ts'], plugins: { gspot: plugin }, rules: { 'gspot/import-boundaries': 'error' } },
    ];
    const findings = linter.verify("import { b } from '../user/b';", config, { filename: '/repo/features/cart/a.ts' });
    expect(findings.map(({ ruleId, messageId }) => ({ ruleId, messageId }))).toStrictEqual([
        { ruleId: 'gspot/import-boundaries', messageId: 'escape' },
    ]);
});
