import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { noIndexImports } from '#plugin/rules/no-index-imports.ts';

createRuleTester().run('no-index-imports', noIndexImports, {
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
        { code: "import { env } from '@/env/index.js';", errors: [{ messageId: 'index' }] },
    ],
});
