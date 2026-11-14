import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { ImportBoundariesOptions } from '#eslint-plugin/types/structure.ts';
import { importBoundaries } from '#eslint-plugin/rules/structure/import-boundaries.ts';

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
            { code: "import { a } from '../../x';", filename: '/elsewhere/src/cart/a.ts' },
            { code: 'const page = await import(route);', filename: '/repo/features/cart/a.ts' },
        ],
        invalid: [
            {
                name: 'exact alias cannot represent a child module',
                code: "import { a } from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '@lib': 'src/lib' } }],
                output: null,
                errors: [
                    { messageId: 'escape', data: { source: '../lib/a.js', folder: 'src/app', target: 'src/lib' } },
                ],
            },
            {
                name: 'suffix wildcard alias represents a child module',
                code: "import { a } from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '#lib/*.js': 'src/lib/*.js' } }],
                output: "import { a } from '#lib/a.js';",
                errors: [{ messageId: 'alias', data: { alias: '#lib/a.js', source: '../lib/a.js' } }],
            },
            {
                code: "import metadata from '../../package.json';",
                filename: '/repo/packages/cli/src/main.ts',
                options: [{ aliases: { '#cli-package': 'packages/package.json' } }],
                output: "import metadata from '#cli-package';",
                errors: [{ messageId: 'alias', data: { alias: '#cli-package', source: '../../package.json' } }],
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
                code: 'import { a } from "../../config/a.js";',
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: { '@/*': 'src/*', '@config/*': 'config/*' } }],
                output: 'import { a } from "@config/a.js";',
                errors: [{ messageId: 'alias', data: { alias: '@config/a.js', source: '../../config/a.js' } }],
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
                options: [{ aliases: { '@/*': 'src/*', '@config/*': 'config/*' } }],
                output: null,
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                code: "export { a } from '../../supabase/src/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ folders: ['api', 'supabase'] }],
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../../supabase/src/a.js', folder: 'api', target: 'supabase' },
                    },
                ],
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
                name: 'sibling feature import on Windows',
                code: "import { b } from '../user/b';",
                filename: String.raw`C:\repo\features\cart\a.ts`,
                settings: { gspot: { root: String.raw`c:\repo` } },
                errors: [
                    {
                        messageId: 'escape',
                        data: { source: '../user/b', folder: 'features/cart', target: 'features/user' },
                    },
                ],
            },
            {
                name: 'the alias fix keeps a resource query',
                code: "import text from '../lib/a.txt?raw';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '@/*': 'src/*' } }],
                output: "import text from '@/lib/a.txt?raw';",
                errors: [{ messageId: 'alias', data: { alias: '@/lib/a.txt?raw', source: '../lib/a.txt?raw' } }],
            },
            {
                name: 'the alias fix escapes a quote that the alias holds',
                code: "import a from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { "@owner's/*": 'src/*' } }],
                output: String.raw`import a from '@owner\'s/lib/a.js';`,
                errors: [{ messageId: 'alias', data: { alias: "@owner's/lib/a.js", source: '../lib/a.js' } }],
            },
            {
                name: 'an alias target written as in tsconfig paths, with ./, gives the alias fix',
                code: "import { a } from '../turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [{ aliases: { '@/*': './src/*' } }],
                output: "import { a } from '@/turn/a.js';",
                errors: [{ messageId: 'alias', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
            },
            {
                name: 'a wildcard alias with an exact target never writes the pattern itself as the import',
                code: "import lib from '../lib';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '@/*': 'src/lib' } }],
                output: null,
                errors: [{ messageId: 'escape', data: { source: '../lib', folder: 'src/app', target: 'src/lib' } }],
            },
            {
                name: 'an alias target whose prefix and suffix overlap does not match a shorter path',
                code: "import value from '../../s';",
                filename: '/repo/src/app/main.ts',
                options: [{ aliases: { '@/*': 's*s' } }],
                output: null,
                errors: [{ messageId: 'escape', data: { source: '../../s', folder: 'src/app', target: 's' } }],
            },
            {
                code: "import { a } from '..';",
                filename: '/repo/src/cart/a.ts',
                output: null,
                errors: [{ messageId: 'escape', data: { source: '..', folder: 'src/cart', target: 'src' } }],
            },
        ],
    },
);

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
