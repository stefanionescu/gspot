import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noIndexImports } from '#eslint-plugin/rules/structure/no-index-imports.ts';

buildRuleTester().run('no-index-imports', noIndexImports, {
    valid: [
        "vi.requireActual('@/turn/index.js');",
        "import { a } from '@scope/package/index';",
        "import { a } from '#app/myindex';",
    ],
    invalid: [
        { code: "import { a } from '~/lib/index.js';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '#app/index';", errors: [{ messageId: 'index' }] },
        {
            code: "import { a } from './index.js';",
            errors: [{ messageId: 'index', data: { source: './index.js' } }],
        },
        { code: "import { a } from '../index';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '#app/routes/index.ts';", errors: [{ messageId: 'index' }] },
        { code: "export * from './lib/index.js';", errors: [{ messageId: 'index' }] },
        { code: "const m = await import('./index.js');", errors: [{ messageId: 'index' }] },
        ...['vi', 'jest'].flatMap((host) =>
            ['mock', host === 'vi' ? 'importActual' : 'requireActual'].map((method) => ({
                code: `${host}.${method}('@/turn/index.js');`,
                errors: [{ messageId: 'index' as const }],
            })),
        ),
    ],
});

buildRuleTester().run('no-index-imports regressions', noIndexImports, {
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

buildRuleTester({ languageOptions: { sourceType: 'commonjs' } }).run('no-index-imports require calls', noIndexImports, {
    valid: [],
    invalid: [
        {
            code: "const a = require('./lib/index.js');",
            filename: '/repo/src/feature/sample.cjs',
            errors: [{ messageId: 'index' }],
        },
    ],
});
