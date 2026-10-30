export const REASON_VALUES = [
    {
        key: 'limits.file_lines',
        root: '200',
        child: '400',
        value: [200, 400],
        needsReason: true,
    },
    {
        key: 'limits.trivial_function_statements',
        root: '3',
        child: '1',
        value: [3, 1],
        needsReason: true,
    },
    {
        key: 'dependencies.allowed_registries',
        root: '["registry.npmjs.org", "registry.yarnpkg.com"]',
        child: '["registry.example.com"]',
        value: [
            ['registry.npmjs.org', 'registry.yarnpkg.com'],
            ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
        ],
        needsReason: true,
    },
    {
        key: 'naming.banned_words',
        root: '["temporary"]',
        child: '["other"]',
        value: [['temporary'], ['temporary', 'other']],
        needsReason: false,
    },
] as const;

export const SCOPE_SETTING_EXPLANATION = {
    scopes: [
        { scope: 'api', value: 90, source: '[scope "api"]' },
        { scope: 'api/worker', value: 95, source: '[scope "api/worker"]' },
    ],
} as const;

export const SCOPE_ROOT_MESSAGE = 'Scope: root';

export const NAMING_LIMITS = [
    { key: 'naming.swift.max_characters', shipped: 40, child: 38 },
    { key: 'naming.sql.max_words', shipped: 7, child: 7 },
];
