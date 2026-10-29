export const REASON_VALUES = [
    {
        key: 'limits.file_lines',
        root: '200',
        child: '400',
        value: [200, 400],
        needsReason: [false, true] as const,
    },
    {
        key: 'limits.trivial_function_statements',
        root: '3',
        child: '1',
        value: [3, 1],
        needsReason: [false, true] as const,
    },
    {
        key: 'dependencies.allowed_registries',
        root: '["registry.npmjs.org", "registry.yarnpkg.com"]',
        child: '["registry.example.com"]',
        value: [
            ['registry.npmjs.org', 'registry.yarnpkg.com'],
            ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
        ],
        needsReason: [false, true] as const,
    },
    {
        key: 'naming.banned_words',
        root: '["temporary"]',
        child: '["other"]',
        value: [['temporary'], ['temporary', 'other']],
        needsReason: [false, false] as const,
    },
] as const;

export const SCOPE_SETTING_EXPLANATION = {
    scopes: [
        { scope: 'api', value: 90, source: '[scope "api"]' },
        { scope: 'api/worker', value: 95, source: '[scope "api/worker"]' },
    ],
} as const;

export const REASON_EXPLANATIONS = {
    'limits.file_lines': {
        text: 'limits.file_lines\n\nThe most lines one file may have, not counting blank lines and comment-only lines.\n\nReason: raising needs a reason\n\nScope: root\nShipped default: 300\nCurrent value: 200 (from gspot.toml)\nRead by: structure/long-files (off at level basic)\nChange it: gspot set limits.file_lines <value> [--reason "<why>"]\nBack to the default: gspot unset limits.file_lines\n\nScope: app\nShipped default: 300\nCurrent value: 400 (from [scope "app"])\nRead by: structure/long-files (off at level basic)\nIf you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.\nReason on record: The sandbox preserves the project convention for this native setting.\nChange it: gspot set limits.file_lines <value> --scope app [--reason "<why>"]\nBack to the default: gspot unset limits.file_lines --scope app\n',
        json: {
            key: 'limits.file_lines',
            type: 'number',
            default: 300,
            configurations: ['sql', 'structure'],
            description: 'The most lines one file may have, not counting blank lines and comment-only lines.',
            reason_when: 'raising',
            languages: ['typescript', 'javascript', 'python', 'swift', 'sql', 'bash'],
            language_defaults: {
                sql: 400,
                bash: 140,
            },
            scopes: [
                {
                    scope: '',
                    default: 300,
                    value: 200,
                    source: 'gspot.toml',
                    readBy: ['structure/long-files (off at level basic)'],
                },
                {
                    scope: 'app',
                    default: 300,
                    value: 400,
                    source: '[scope "app"]',
                    reason: 'The sandbox preserves the project convention for this native setting.',
                    readBy: ['structure/long-files (off at level basic)'],
                },
            ],
            kind: 'setting',
            subject: 'limits.file_lines',
        },
    },
    'limits.trivial_function_statements': {
        text: 'limits.trivial_function_statements\n\nFunctions with this many statements or fewer are reported, nested functions included. A higher number reports more functions.\n\nReason: lowering needs a reason\n\nScope: root\nShipped default: 2\nCurrent value: 3 (from gspot.toml)\nRead by: structure/trivial-functions (off at level basic)\nChange it: gspot set limits.trivial_function_statements <value> [--reason "<why>"]\nBack to the default: gspot unset limits.trivial_function_statements\n\nScope: app\nShipped default: 2\nCurrent value: 1 (from [scope "app"])\nRead by: structure/trivial-functions (off at level basic)\nIf you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.\nReason on record: The sandbox preserves the project convention for this native setting.\nChange it: gspot set limits.trivial_function_statements <value> --scope app [--reason "<why>"]\nBack to the default: gspot unset limits.trivial_function_statements --scope app\n',
        json: {
            key: 'limits.trivial_function_statements',
            type: 'number',
            default: 2,
            minimum: 1,
            configurations: ['structure'],
            description:
                'Functions with this many statements or fewer are reported, nested functions included. A higher number reports more functions.',
            reason_when: 'lowering',
            languages: ['typescript', 'javascript', 'python', 'swift', 'bash'],
            scopes: [
                {
                    scope: '',
                    default: 2,
                    value: 3,
                    source: 'gspot.toml',
                    readBy: ['structure/trivial-functions (off at level basic)'],
                },
                {
                    scope: 'app',
                    default: 2,
                    value: 1,
                    source: '[scope "app"]',
                    reason: 'The sandbox preserves the project convention for this native setting.',
                    readBy: ['structure/trivial-functions (off at level basic)'],
                },
            ],
            kind: 'setting',
            subject: 'limits.trivial_function_statements',
        },
    },
    'dependencies.allowed_registries': {
        text: 'dependencies.allowed_registries\n\nThe hosts a lockfile may resolve packages from.\n\nReason: adding needs a reason\n\nScope: root\nShipped default: ["registry.npmjs.org","registry.yarnpkg.com"]\nCurrent value: ["registry.npmjs.org","registry.yarnpkg.com"] (from gspot.toml)\nChange it: gspot set dependencies.allowed_registries <value> [--reason "<why>"]\nBack to the default: gspot unset dependencies.allowed_registries\n\nScope: app\nShipped default: ["registry.npmjs.org","registry.yarnpkg.com"]\nCurrent value: ["registry.npmjs.org","registry.yarnpkg.com","registry.example.com"] (from [scope "app"])\nIf you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.\nReason on record: The sandbox preserves the project convention for this native setting.\nChange it: gspot set dependencies.allowed_registries <value> --scope app [--reason "<why>"]\nBack to the default: gspot unset dependencies.allowed_registries --scope app\n',
        json: {
            key: 'dependencies.allowed_registries',
            type: 'list',
            default: ['registry.npmjs.org', 'registry.yarnpkg.com'],
            configurations: ['dependencies'],
            description: 'The hosts a lockfile may resolve packages from.',
            reason_when: 'adding',
            scopes: [
                {
                    scope: '',
                    default: ['registry.npmjs.org', 'registry.yarnpkg.com'],
                    value: ['registry.npmjs.org', 'registry.yarnpkg.com'],
                    source: 'gspot.toml',
                },
                {
                    scope: 'app',
                    default: ['registry.npmjs.org', 'registry.yarnpkg.com'],
                    value: ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
                    source: '[scope "app"]',
                    reason: 'The sandbox preserves the project convention for this native setting.',
                },
            ],
            kind: 'setting',
            subject: 'dependencies.allowed_registries',
        },
    },
    'naming.banned_words': {
        text: 'naming.banned_words\n\nWords this repository bans in identifiers, beyond the shipped groups.\n\nScope: root\nShipped default: []\nCurrent value: ["temporary"] (from gspot.toml)\nChange it: gspot set naming.banned_words <value> [--reason "<why>"]\nBack to the default: gspot unset naming.banned_words\n\nScope: app\nShipped default: []\nCurrent value: ["temporary","other"] (from [scope "app"])\nChange it: gspot set naming.banned_words <value> --scope app [--reason "<why>"]\nBack to the default: gspot unset naming.banned_words --scope app\n',
        json: {
            key: 'naming.banned_words',
            type: 'list',
            default: [],
            configurations: ['naming'],
            description: 'Words this repository bans in identifiers, beyond the shipped groups.',
            scopes: [
                {
                    scope: '',
                    default: [],
                    value: ['temporary'],
                    source: 'gspot.toml',
                },
                {
                    scope: 'app',
                    default: [],
                    value: ['temporary', 'other'],
                    source: '[scope "app"]',
                },
            ],
            kind: 'setting',
            subject: 'naming.banned_words',
        },
    },
} as const;

export const SCOPE_ROOT_MESSAGE = 'Scope: root';

export const NAMING_LIMITS = [
    { key: 'naming.swift.max_characters', shipped: 40, child: 38 },
    { key: 'naming.sql.max_words', shipped: 7, child: 7 },
];
