import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { importExtensions } from '#plugin/rules/import-extensions.ts';

createRuleTester().run('import-extensions', importExtensions, {
    valid: [
        { code: "import { value } from '@team/owner.js';", options: [{ internalPrefixes: ['@team/'] }] },
        { code: "import logo from './logo.png';", options: [{ style: 'js' }] },
        { code: "import font from './font.woff2';", options: [{ style: 'ts' }] },
        { code: "import text from './source.ts?raw';", options: [{ style: 'js' }] },
        { code: "import { a } from './a.js';", options: [{ style: 'js' }] },
        { code: "import { a } from '@/a.js';", options: [{ style: 'js' }] },
        { code: "import { a } from 'package';", options: [{ style: 'js' }] },
        { code: "import data from './data.json';", options: [{ style: 'js' }] },
        { code: 'import manifest from "#manifest" with { type: "json" };', options: [{ style: 'ts' }] },
        { code: 'export { default } from "#manifest" with { "type": "json" };', options: [{ style: 'js' }] },
        { code: "import { a } from './a.ts';", options: [{ style: 'ts' }] },
        { code: "import { a } from './a';", options: [{ style: 'extensionless' }] },
        { code: "import { a } from '~/a';", options: [{ style: 'js', internalPrefixes: ['./'] }] },
    ],
    invalid: [
        {
            code: "import { value } from '@team/owner.ts';",
            options: [{ internalPrefixes: ['@team/'] }],
            errors: [{ messageId: 'js', data: { source: '@team/owner.ts' } }],
        },
        {
            code: 'import manifest from "#manifest" with { type: "json" }; import { value } from "./owner";',
            options: [{ style: 'ts' }],
            errors: [{ messageId: 'ts', data: { source: './owner' } }],
        },
        {
            code: "import { a } from './a';",
            options: [{ style: 'js' }],
            errors: [{ messageId: 'js', data: { source: './a' } }],
        },
        {
            code: "import { a } from './a.ts';",
            options: [{ style: 'js' }],
            errors: [{ messageId: 'js' }],
        },
        {
            code: "import { a } from '../a.js';",
            options: [{ style: 'ts' }],
            errors: [{ messageId: 'ts' }],
        },
        {
            code: "export * from './a.js';",
            options: [{ style: 'extensionless' }],
            errors: [{ messageId: 'extensionless' }],
        },
        { code: "const m = await import('#app/a');", options: [{ style: 'js' }], errors: [{ messageId: 'js' }] },
    ],
});
