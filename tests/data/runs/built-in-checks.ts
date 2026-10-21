export const HEADERS_FILE = `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: same-origin
    X-Frame-Options: DENY
`;

export const SCOPE_FINDINGS = [
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'admin-key' }],
    },
    {
        check: 'translations/messages',
        root: [],
        nested: [{ file: 'apps/backend/messages/de.json' }],
    },
    {
        check: 'cloudflare/headers',
        root: [],
        nested: [
            { file: 'apps/backend/_headers', rule: 'missing-header' },
            { file: 'apps/backend/_headers', rule: 'missing-header' },
        ],
    },
    {
        check: 'site/unused-assets',
        root: [{ file: 'assets/unused.png', rule: 'dead-asset' }],
        nested: [],
    },
] as const;
