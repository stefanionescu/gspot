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
            'Files: db/migrations/*.sql, migrations/*.sql, prisma/migrations/*/migration.sql, drizzle/*.sql, **/supabase/migrations/*.sql',
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
    { check: 'gspot/unmatched-paths', tools: [] },
    { check: 'react-dom/react-versions', tools: [] },
    { check: 'javascript/eslint', tools: ['node'] },
    { check: 'dependencies/osv-scanner', tools: ['osv-scanner'] },
    { check: 'python/ruff', tools: ['ruff'] },
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
    check: 'project/syntax',
    stage: 'manual',
    command: ['bash', '-n', '{files}'],
    paths: ['**/*.sh'],
} as const;

export const SYNTAX_CHECK_TABLES = `[[command_check]]
id = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "manual"
`;

export const UNKNOWN_SUBJECT_CASES = [
    ['./missing.sh', 'missing.sh is not a file in this repository.'],
    [
        'unknown-configuration',
        'gspot cannot explain unknown-configuration. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).',
    ],
] as const;
