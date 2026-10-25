export const QUALITY_SEARCH_ARGUMENTS = [
    '--text',
    'corrected\n',
    '--match',
    'differs',
    '--log',
    'checked.txt',
    '--',
    '{files}',
];

export const QUALITY_FIX_ARGUMENTS = ['--log-arguments', 'fixed.txt', '--text', 'corrected\n', '--', '{files}'];

const HEADERS_FILE = `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: same-origin
    X-Frame-Options: DENY
`;

export const SCOPE_FINDINGS = [
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'service-role-key' }],
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
        root: [{ file: 'assets/unused.png', rule: 'unused-asset' }],
        nested: [],
    },
] as const;

export const SCOPE_CHECK_FILES = {
    'package.json': '{"private":true,"dependencies":{"next-intl":"4.8.3"}}',
    _headers: HEADERS_FILE,
    'messages/en.json': '{"title":"Home"}',
    'messages/de.json': '{"title":"Start"}',
    'supabase/config.toml': '[functions.root]\nverify_jwt = true\n',
    'supabase/functions/root/index.ts': 'export {};\n',
    'assets/unused.png': new Uint8Array([0, 1, 2, 3]),
    'apps/backend/index.html': '<img alt="Backend diagram" src="/assets/unused.png">',
    'apps/backend/_headers': '/*\n    X-Content-Type-Options: nosniff\n',
    'apps/backend/messages/en.json': '{"heading":"Backend"}',
    'apps/backend/messages/de.json': '{}',
    'apps/backend/supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
    'apps/backend/client.ts': 'const credentialName = "SUPABASE_SERVICE_ROLE_KEY";\n',
} as const;
