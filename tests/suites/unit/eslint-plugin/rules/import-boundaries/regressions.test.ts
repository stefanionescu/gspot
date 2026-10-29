import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { ImportBoundariesOptions } from '#eslint-plugin/types/rules.ts';

createRuleTester().run<'alias' | 'escape', [Partial<ImportBoundariesOptions[0]>]>(
    'import-boundaries regressions',
    plugin.rules['import-boundaries'],
    {
        valid: [
            {
                code: "import { a } from '..';",
                filename: '/repo/src/cart/items/a.ts',
            },
        ],
        invalid: [
            {
                code: "import text from '../lib/a.txt?raw';",
                filename: '/repo/src/app/main.ts',
                options: [
                    {
                        aliases: {
                            '@/*': 'src/*',
                        },
                    },
                ],
                name: 'the alias fix keeps a resource query',
                errors: [{ messageId: 'alias' }],
                output: "import text from '@/lib/a.txt?raw';",
            },
            {
                code: "import a from '../lib/a.js';",
                filename: '/repo/src/app/main.ts',
                options: [
                    {
                        aliases: {
                            "@owner's/*": 'src/*',
                        },
                    },
                ],
                name: 'the alias fix escapes a quote that the alias holds',
                errors: [{ messageId: 'alias' }],
                output: String.raw`import a from '@owner\'s/lib/a.js';`,
            },
            {
                code: "import { a } from '../turn/a.js';",
                filename: '/repo/src/other/b.ts',
                options: [
                    {
                        aliases: {
                            '@/*': './src/*',
                        },
                    },
                ],
                name: 'an alias target written as in tsconfig paths, with ./, gives the alias fix',
                errors: [{ messageId: 'alias' }],
                output: "import { a } from '@/turn/a.js';",
            },
            {
                code: "import lib from '../lib';",
                filename: '/repo/src/app/main.ts',
                options: [
                    {
                        aliases: {
                            '@/*': 'src/lib',
                        },
                    },
                ],
                name: 'a wildcard alias with an exact target never writes the pattern itself as the import',
                errors: [{ messageId: 'escape' }],
                output: null,
            },
            {
                code: "import a = require('../../other/a');",
                filename: '/repo/apps/api/src/b.ts',
                options: [
                    {
                        folders: ['apps/api'],
                    },
                ],
                name: 'a TypeScript import-equals require that leaves the folder reports',
                errors: [{ messageId: 'escape' }],
            },
            {
                code: "type A = import('../../other/a').A;",
                filename: '/repo/apps/api/src/b.ts',
                options: [
                    {
                        folders: ['apps/api'],
                    },
                ],
                name: 'a type import() that leaves the folder reports',
                errors: [{ messageId: 'escape' }],
            },
            {
                code: "import value from '../../s';",
                filename: '/repo/src/app/main.ts',
                options: [
                    {
                        aliases: {
                            '@/*': 's*s',
                        },
                    },
                ],
                name: 'an alias target whose prefix and suffix overlap does not match a shorter path',
                errors: [{ messageId: 'escape' }],
                output: null,
            },
            {
                code: "import { a } from '..';",
                filename: '/repo/src/cart/a.ts',
                errors: [
                    {
                        messageId: 'escape',
                    },
                ],
                output: null,
            },
        ],
    },
);

createRuleTester({ languageOptions: { sourceType: 'commonjs' } }).run<
    'alias' | 'escape',
    [Partial<ImportBoundariesOptions[0]>]
>('import-boundaries require calls', plugin.rules['import-boundaries'], {
    valid: [],
    invalid: [
        {
            code: "const a = require('../../other/a.js');",
            filename: '/repo/apps/api/src/b.cjs',
            options: [{ folders: ['apps/api'] }],
            errors: [{ messageId: 'escape' }],
        },
    ],
});
