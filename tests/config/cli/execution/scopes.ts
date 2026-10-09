import type { ScopeReaderFindings } from '#tests/types/cli/execution.ts';

export const READERS_HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: same-origin\n    X-Frame-Options: DENY\n';

export const EXPECTED_READERS: ScopeReaderFindings[] = [
    {
        check: 'supabase/project-file',
        root: [],
        nested: [{ file: 'apps/backend/supabase/config.toml', rule: 'function' }],
    },
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'admin-key' }],
    },
    {
        check: 'translations/locales',
        root: [],
        nested: [{ file: 'apps/backend/messages/de.json' }],
    },
    {
        check: 'cloudflare/security-headers',
        root: [],
        nested: [
            { file: 'apps/backend/_headers', rule: 'missing-header' },
            { file: 'apps/backend/_headers', rule: 'missing-header' },
        ],
    },
    {
        check: 'site/dead-assets',
        root: [{ file: 'assets/unused.png', rule: 'dead-asset' }],
        nested: [],
    },
];
