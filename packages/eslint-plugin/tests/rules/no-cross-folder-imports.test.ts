import { tester } from '#plugin-tests/harness/tester.ts';
import { noCrossFolderImports } from '#plugin/rules/no-cross-folder-imports.ts';

const aliases = { '@/': 'src/', '@config/': 'config/', '@tests/': 'tests/' };

tester().run('no-cross-folder-imports', noCrossFolderImports, {
    valid: [
        { code: "import { a } from './a.js';", filename: '/repo/src/turn/b.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/a.js';", filename: '/repo/src/other/b.ts', options: [{ aliases }] },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/scripts/inner/b.ts',
            options: [{ aliases, scope: ['src'] }],
        },
    ],
    invalid: [
        {
            code: "import { a } from '../turn/a.js';",
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: "import { a } from '@/turn/a.js';",
            errors: [{ messageId: 'cross', data: { alias: '@/turn/a.js', source: '../turn/a.js' } }],
        },
        {
            code: 'import { a } from "../../config/a.js";',
            filename: '/repo/src/other/b.ts',
            options: [{ aliases }],
            output: 'import { a } from "@config/a.js";',
            errors: [{ messageId: 'cross' }],
        },
        {
            code: "import { a } from '../a.js';",
            filename: '/repo/lib/inner/b.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'crossNoAlias' }],
        },
    ],
});
