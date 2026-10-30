export const RULE_PAGES = [
    ['no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['eslint/no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/#no-trivial-functions'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    [
        'eslint/unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    ['eslint/@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    ['stylelint/color-no-invalid-hex', 'https://stylelint.io/user-guide/rules/color-no-invalid-hex'],
] as const;

export const UNKNOWN_RULES = [
    'eslint/no-consolee',
    'eslint/unicorn/no-such-rule',
    'eslint/unknown/no-such-rule',
    'eslint/typescript-eslint/no-explicit-any',
    'stylelint/no-such-rule',
] as const;

export const CHILD_RULE_PAGE = {
    tool: 'swiftlint',
    rule: 'type_body_length',
    check: 'swift/swiftlint',
    page: 'https://realm.github.io/SwiftLint/type_body_length.html',
} as const;

export const ROOT_RULE_PAGE = {
    tool: 'ruff',
    rule: 'F401',
    check: 'python/ruff',
    page: 'https://docs.astral.sh/ruff/rules/F401/',
} as const;

export const RULE_PAGE_SETTINGS = `level = "all"
configurations = ["python"]
[[scope]]
path = "app"
configurations = ["swift"]
`;

export const SHELLCHECK_RULE_PAGE = {
    kind: 'lint-rule',
    tool: 'shellcheck',
    rule: 'SC2086',
    page: 'https://www.shellcheck.net/wiki/SC2086',
} as const;

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

export const EXPLAIN_SETTINGS = `configurations = []

[[scope]]\npath = "api"
configurations = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

export const CONFIGURATION_DETECTION_LINES = [
    {
        configuration: 'docker',
        lines: [
            'Detected by: **/Dockerfile, **/Dockerfile.*, **/*.dockerfile, **/docker-compose*.yml, **/docker-compose*.yaml, **/compose.{yml,yaml}, **/compose.*.{yml,yaml}, **/compose-*.{yml,yaml}, !**/*.dockerignore',
            'Files: **/Dockerfile, **/Dockerfile.*, **/*.dockerfile, **/docker-compose*.yml, **/docker-compose*.yaml, **/compose.{yml,yaml}, **/compose.*.{yml,yaml}, **/compose-*.{yml,yaml}, **/.dockerignore, **/*.dockerignore',
        ],
    },
    {
        configuration: 'javascript',
        lines: [
            'Detected by: .js, .jsx, .mjs, .cjs, project file package.json, shebang node',
            'Files: .js, .jsx, .mjs, .cjs, shebang:node',
            'Files: the file types of the selected ESLint plugins',
        ],
    },
    {
        configuration: 'bash',
        lines: [
            'Detected by: .sh, .bash, .zsh, .bats, tag shebang:shell',
            'Files: .sh, .bash, .zsh, .bats, shebang:shell',
        ],
    },
    {
        configuration: 'postgres',
        lines: [
            String.raw`Detected by: pg in dependencies, postgres in dependencies, psycopg* in dependencies, asyncpg in dependencies, @neondatabase/serverless in dependencies, prisma/schema.prisma matching (?:^|\n)[\t ]*provider[\t ]*=[\t ]*"postgresql"`,
            'Files: db/migrations/*.sql, migrations/*.sql, prisma/migrations/*/migration.sql, drizzle/*.sql, **/supabase/migrations/*.sql',
        ],
    },
] as const;

export const CHECK_TOOL_MINIMUMS = [
    { check: 'react-dom/react-versions', tools: [] },
    { check: 'javascript/eslint', tools: ['node'] },
] as const;

export const PATH_IGNORES = [
    {
        check: 'bash/shellcheck',
        rule: 'SC2086',
        reason: 'The script deliberately splits a list of arguments.',
    },
] as const;

export const SYNTAX_CHECK_EXPLANATION = {
    kind: 'check',
    subject: 'project/syntax',
    level: 'basic',
    summary: "Runs the repository's own check project/syntax.",
    why: 'This repository runs this command as one of its checks.',
    help: 'Read the command output; this repository declares the check.',
    settings: [],
    rules: [],
    ignores: [],
    check: 'project/syntax',
    stage: 'manual',
    command: ['bash', '-n', '{files}'],
    paths: ['**/*.sh'],
} as const;

export const SYNTAX_CHECK_TABLES =
    '[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "manual"\n';

export const UNKNOWN_SUBJECT_CASES = [
    [
        'unknown/no-such-rule',
        'There is no check, lint rule, configuration, setting, or file called unknown/no-such-rule. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).',
    ],
    ['./missing.sh', 'missing.sh is not a file in this repository.'],
    [
        'unknown-configuration',
        'There is no check, lint rule, configuration, setting, or file called unknown-configuration. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).',
    ],
] as const;
