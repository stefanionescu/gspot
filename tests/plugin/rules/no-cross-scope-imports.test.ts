import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { SCOPES } from '#tests/config/plugin/rules/no-cross-scope-imports.ts';
import { noCrossScopeImports } from '#plugin/rules/no-cross-scope-imports.ts';
import type { CrossScopeImportsOptions } from '#plugin/types/scope-imports.ts';

createRuleTester().run<keyof typeof noCrossScopeImports.meta.messages, [Partial<CrossScopeImportsOptions[0]>]>(
    'no-cross-scope-imports',
    noCrossScopeImports,
    {
        valid: [
            {
                code: "import { a } from './a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ scopes: SCOPES }],
            },
            {
                code: "import { a } from '../types/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ scopes: SCOPES }],
            },
            {
                code: "import { a } from '../../supabase/a.js';",
                filename: '/repo/root/src/b.ts',
                options: [{ scopes: SCOPES }],
            },
            {
                code: "import { a } from './a.js';",
                filename: '/repo/apps/api/src/b.ts',
                options: [{ scopes: ['apps', 'apps/api', 'services/db'] }],
            },
        ],
        invalid: [
            {
                code: "import { a } from '../../quality/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ scopes: SCOPES }],
                errors: [{ messageId: 'escape', data: { scope: 'api', target: 'quality/a.js' } }],
            },
            {
                code: "import { a } from '../../../services/db/src/a.js';",
                filename: '/repo/apps/api/src/b.ts',
                options: [{ scopes: ['apps', 'apps/api', 'services/db'] }],
                errors: [{ messageId: 'escape', data: { scope: 'apps/api', target: 'services/db' } }],
            },
            {
                code: "import { a } from '../../supabase/src/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ scopes: SCOPES }],
                errors: [{ messageId: 'escape', data: { scope: 'api', target: 'supabase' } }],
            },
            {
                code: "export * from '../../ios/a.js';",
                filename: '/repo/api/src/b.ts',
                options: [{ scopes: SCOPES }],
                errors: [{ messageId: 'escape' }],
            },
        ],
    },
);
