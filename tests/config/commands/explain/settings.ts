export const REASON_VALUES = [
    {
        key: 'limits.file_lines',
        root: '200',
        child: '400',
        current: [200, 400],
        needsReason: [false, true] as const,
    },
    {
        key: 'limits.trivial_function_statements',
        root: '3',
        child: '1',
        current: [3, 1],
        needsReason: [false, true] as const,
    },
    {
        key: 'dependencies.allowed_registries',
        root: '["registry.npmjs.org", "registry.yarnpkg.com"]',
        child: '["registry.example.com"]',
        current: [
            ['registry.npmjs.org', 'registry.yarnpkg.com'],
            ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
        ],
        needsReason: [false, true] as const,
    },
    {
        key: 'naming.banned_words',
        root: '["temporary"]',
        child: '["other"]',
        current: [['temporary'], ['temporary', 'other']],
        needsReason: [false, false] as const,
    },
] as const;

export const NAMING_SCOPE_LIMITS = [
    { key: 'naming.swift.max_characters', shipped: 40, child: 38 },
    { key: 'naming.sql.max_words', shipped: 7, child: 7 },
] as const;

export const SCOPE_SETTING_EXPLANATION = {
    scopes: [
        { scope: 'api', current: 90, source: '[scope "api"]' },
        { scope: 'api/worker', current: 95, source: '[scope "api/worker"]' },
    ],
} as const;
