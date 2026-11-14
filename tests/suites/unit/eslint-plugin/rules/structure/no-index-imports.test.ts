import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noIndexImports } from '#eslint-plugin/rules/structure/no-index-imports.ts';

buildRuleTester().run('no-index-imports', noIndexImports, {
    valid: [
        "vi.requireActual('@/turn/index.js');",
        "import { a } from '@scope/package/index';",
        "import { a } from '#app/myindex';",
        {
            code: "import text from './value.ts?raw&file=/index.ts';",
            name: 'query text that ends in /index.ts is not an index import',
        },
        'const page = await import(route);',
        'export const b = 1;\nexport { b as c };',
    ],
    invalid: [
        {
            code: "import { a } from './index.js';",
            errors: [{ messageId: 'index', data: { source: './index.js' } }],
        },
        {
            code: "export * from './lib/index.js';",
            errors: [{ messageId: 'index', data: { source: './lib/index.js' } }],
        },
        {
            code: "const m = await import('./index.js');",
            errors: [{ messageId: 'index', data: { source: './index.js' } }],
        },
        { code: "vi.mock('@/turn/index.js');", errors: [{ messageId: 'index', data: { source: '@/turn/index.js' } }] },
        {
            code: "const a = require('./lib/index.js');",
            errors: [{ messageId: 'index', data: { source: './lib/index.js' } }],
        },
        {
            code: "import a = require('./lib/index');",
            name: 'an import-equals require of an index file reports',
            errors: [{ messageId: 'index', data: { source: './lib/index' } }],
        },
        {
            code: "type A = import('./lib/index.js').A;",
            name: 'a type import() of an index file reports',
            errors: [{ messageId: 'index', data: { source: './lib/index.js' } }],
        },
    ],
});
