export const EXPLAIN_SETTINGS = `configurations = []

[[scope]]\npath = "api"
configurations = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

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

export const CONFIGURATION_DETECTION_LINES = [
    {
        configuration: 'docker',
        lines: [
            'Detected by: **/Dockerfile, **/Dockerfile.*, **/*.dockerfile, **/docker-compose*.yml, **/docker-compose*.yaml, **/compose*.yml, **/compose*.yaml, !**/*.dockerignore',
            'Files: **/Dockerfile, **/Dockerfile.*, **/*.dockerfile, **/docker-compose*.yml, **/docker-compose*.yaml, **/compose*.yml, **/compose*.yaml, **/.dockerignore, **/*.dockerignore',
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
        configuration: 'prose',
        lines: [
            'Detected by: .md, .mdx, .ts, .tsx, .mts, .cts, .js, .mjs, .cjs, .jsx, .swift, .css, .sh, .bash, .zsh, .py, .sql, .pgsql, .psql, tag shebang:shell',
            'Files: .md, .mdx, .ts, .tsx, .mts, .cts, .js, .mjs, .cjs, .jsx, .swift, .css, .sh, .bash, .zsh, .py, .sql, .pgsql, .psql, shebang:shell',
        ],
    },
    {
        configuration: 'postgres',
        lines: [
            String.raw`Detected by: pg in dependencies, postgres in dependencies, psycopg in dependencies, asyncpg in dependencies, @neondatabase/serverless in dependencies, prisma/schema.prisma matching (?:^|\n)[\t ]*provider[\t ]*=[\t ]*"postgresql"`,
            'Files: db/migrations/*.sql, migrations/*.sql, **/supabase/migrations/*.sql',
        ],
    },
    {
        configuration: 'xcode',
        lines: [
            'Detected by: project file *.xcodeproj',
            'Files: .plist, .entitlements, .xcconfig, .xcstrings, .storyboard, .xib, **/project.pbxproj, **/*.xcscheme, **/*.xctestplan, **/*.xcassets/**/Contents.json',
        ],
    },
] as const;

export const CHECK_TOOL_MINIMUMS = [
    { check: 'gspot/unmatched-patterns', tools: [] },
    { check: 'react-dom/react-versions', tools: [] },
    { check: 'javascript/eslint', tools: ['node'] },
    { check: 'dependencies/osv-scanner', tools: ['osv-scanner'] },
] as const;

/** Naming limits with distinct language defaults and one stricter child value. */
export const NAMING_SCOPE_LIMITS = [
    { key: 'naming.swift.max_characters', shipped: 40, child: 38 },
    { key: 'naming.sql.max_words', shipped: 7, child: 7 },
] as const;

/** Bare and plugin-prefixed ESLint names resolve to the page declared for their rule. */
export const RULE_PAGES = [
    ['no-undef', 'https://eslint.org/docs/latest/rules/no-undef'],
    ['no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['eslint/no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/'],
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
    ['eslint/sonarjs/no-identical-functions', null],
] as const;
