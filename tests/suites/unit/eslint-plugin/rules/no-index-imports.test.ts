import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';

createRuleTester().run('no-index-imports', plugin.rules['no-index-imports'], {
    valid: [
        "vi.requireActual('@/turn/index.js');",
        "jest.importActual('@/turn/index.js');",
        "import { a } from '@scope/package/index';",
        "import { a } from '#app/myindex';",
        "import { a } from './a';",
        "import { a } from '@/turn/build.js';",
        "import { a } from 'package/index.js';",
        "import { a } from './indexes.js';",
    ],
    invalid: [
        { code: "import { a } from '~/lib/index.js';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '#app/index';", errors: [{ messageId: 'index' }] },
        {
            code: "import { a } from './index.js';",
            errors: [{ messageId: 'index', data: { source: './index.js' } }],
        },
        { code: "import { a } from '../index';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '@/turn/index.js';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '#app/routes/index.ts';", errors: [{ messageId: 'index' }] },
        { code: "export * from './lib/index.js';", errors: [{ messageId: 'index' }] },
        { code: "const m = await import('./index.js');", errors: [{ messageId: 'index' }] },
        ...['vi', 'jest'].flatMap((host) =>
            ['mock', 'doMock', host === 'vi' ? 'importActual' : 'requireActual'].map((method) => ({
                code: `${host}.${method}('@/turn/index.js');`,
                errors: [{ messageId: 'index' as const }],
            })),
        ),
    ],
});

createRuleTester().run('no-index-imports regressions', plugin.rules['no-index-imports'], {
    valid: [
        {
            code: "import text from './value.ts?raw&file=/index.ts';",
            name: 'query text that ends in /index.ts is not an index import',
        },
    ],
    invalid: [
        {
            code: "vi.importMock('./lib/index.js');",
            name: 'vi.importMock of an index file reports',
            errors: [{ messageId: 'index' }],
        },
        {
            code: "jest.requireMock('./lib/index.js');",
            name: 'jest.requireMock of an index file reports',
            errors: [{ messageId: 'index' }],
        },
        {
            code: "vi.unmock('./lib/index.js');",
            name: 'vi.unmock of an index file reports',
            errors: [{ messageId: 'index' }],
        },
        {
            code: "import a = require('./lib/index');",
            name: 'an import-equals require of an index file reports',
            errors: [{ messageId: 'index' }],
        },
        {
            code: "type A = import('./lib/index.js').A;",
            name: 'a type import() of an index file reports',
            errors: [{ messageId: 'index' }],
        },
    ],
});

createRuleTester({ languageOptions: { sourceType: 'commonjs' } }).run(
    'no-index-imports require calls',
    plugin.rules['no-index-imports'],
    {
        valid: [],
        invalid: [
            {
                code: "const a = require('./lib/index.js');",
                filename: '/repo/src/feature/sample.cjs',
                errors: [{ messageId: 'index' }],
            },
        ],
    },
);
