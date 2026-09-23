import { tester } from '#tests/support/plugin/tester.ts';
import { importPathStyle } from '#plugin/rules/import-path-style.ts';

tester().run('import-path-style', importPathStyle, {
    valid: [
        { code: "import { a } from './a.js';", options: [{ style: 'js' }] },
        { code: "import { a } from '@/a.js';", options: [{ style: 'js' }] },
        { code: "import { a } from 'package';", options: [{ style: 'js' }] },
        { code: "import data from './data.json';", options: [{ style: 'js' }] },
        { code: "import { a } from './a.ts';", options: [{ style: 'ts' }] },
        { code: "import { a } from './a';", options: [{ style: 'extensionless' }] },
        { code: "import { a } from '~/a';", options: [{ style: 'js', internalPrefixes: ['./'] }] },
    ],
    invalid: [
        {
            code: "import { a } from './a';",
            options: [{ style: 'js' }],
            errors: [{ messageId: 'js', data: { source: './a' } }],
        },
        { code: "import { a } from './a.ts';", options: [{ style: 'js' }], errors: [{ messageId: 'js' }] },
        { code: "import { a } from '../a.js';", options: [{ style: 'ts' }], errors: [{ messageId: 'ts' }] },
        {
            code: "export * from './a.js';",
            options: [{ style: 'extensionless' }],
            errors: [{ messageId: 'extensionless' }],
        },
        { code: "const m = await import('#app/a');", options: [{ style: 'js' }], errors: [{ messageId: 'js' }] },
    ],
});
