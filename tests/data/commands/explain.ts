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
        table: 'limits',
        field: 'file_lines',
        root: '200',
        child: '400',
        current: [200, 400],
        owed: [false, true] as const,
    },
    {
        key: 'limits.trivial_function_statements',
        table: 'limits',
        field: 'trivial_function_statements',
        root: '3',
        child: '1',
        current: [3, 1],
        owed: [false, true] as const,
    },
    {
        key: 'dependencies.allowed_registries',
        table: 'dependencies',
        field: 'allowed_registries',
        root: '["registry.npmjs.org", "registry.yarnpkg.com"]',
        child: '["registry.example.com"]',
        current: [
            ['registry.npmjs.org', 'registry.yarnpkg.com'],
            ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
        ],
        owed: [false, true] as const,
    },
    {
        key: 'naming.banned_words',
        table: 'naming',
        field: 'banned_words',
        root: '["temporary"]',
        child: '["other"]',
        current: [['temporary'], ['temporary', 'other']],
        owed: [false, false] as const,
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
        lines: ['Detected by: .sh, .bash, .zsh, .bats, shebang shell', 'Files: .sh, .bash, .zsh, .bats, shebang:shell'],
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
            'Detected by: **/*.xcodeproj/project.pbxproj, project file *.xcodeproj',
            'Files: .plist, .entitlements, .xcconfig, .xcstrings, .storyboard, .xib, **/project.pbxproj, **/*.xcscheme, **/*.xctestplan, **/*.xcassets/**/Contents.json',
        ],
    },
] as const;

export const CHECK_TOOL_MINIMUMS = [
    { check: 'gspot/unmatched-patterns', tools: [] },
    { check: 'dependencies/react-versions', tools: [] },
    { check: 'javascript/eslint', tools: ['node'] },
    { check: 'dependencies/osv-scanner', tools: ['osv-scanner'] },
] as const;
