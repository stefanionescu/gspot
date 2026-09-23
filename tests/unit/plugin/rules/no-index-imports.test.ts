import { tester } from '#tests/support/plugin/tester.ts';
import { noIndexImports } from '#plugin/rules/no-index-imports.ts';

tester().run('no-index-imports', noIndexImports, {
    valid: [
        "import { a } from './a';",
        "import { a } from '@/turn/build.js';",
        "import { a } from 'package/index.js';",
        { code: "import { env } from '@/env/index.js';", options: [{ allow: ['@/env/index.js'] }] },
        "import { a } from './indexes.js';",
    ],
    invalid: [
        { code: "import { a } from './index.js';", errors: [{ messageId: 'index', data: { source: './index.js' } }] },
        { code: "import { a } from '../index';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '@/turn/index.js';", errors: [{ messageId: 'index' }] },
        { code: "import { a } from '#app/routes/index.ts';", errors: [{ messageId: 'index' }] },
        { code: "export * from './lib/index.js';", errors: [{ messageId: 'index' }] },
        { code: "const m = await import('./index.js');", errors: [{ messageId: 'index' }] },
        { code: "vi.mock('@/turn/index.js');", errors: [{ messageId: 'index' }] },
    ],
});
