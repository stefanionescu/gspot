import { tester } from '#tests/harness/plugin/tester.ts';
import { noCrossScopeImports } from '#plugin/rules/no-cross-scope-imports.ts';

const scopes = ['api', 'supabase'];

tester().run('no-cross-scope-imports', noCrossScopeImports, {
    valid: [
        { code: "import { a } from './a.js';", filename: '/repo/api/src/b.ts', options: [{ scopes }] },
        { code: "import { a } from '../types/a.js';", filename: '/repo/api/src/b.ts', options: [{ scopes }] },
        { code: "import { a } from '../../supabase/a.js';", filename: '/repo/root/src/b.ts', options: [{ scopes }] },
        {
            code: "import { a } from '../../quality/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ scopes, allowedEscapes: ['quality/'] }],
        },
    ],
    invalid: [
        {
            code: "import { a } from '../../supabase/src/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ scopes }],
            errors: [{ messageId: 'escape', data: { scope: 'api', target: 'supabase' } }],
        },
        {
            code: "export * from '../../ios/a.js';",
            filename: '/repo/api/src/b.ts',
            options: [{ scopes }],
            errors: [{ messageId: 'escape' }],
        },
    ],
});
