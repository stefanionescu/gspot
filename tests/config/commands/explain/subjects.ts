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
    subject: 'project/syntax',
    level: 'basic',
    summary: "Runs the repository's own check project/syntax.",
    why: 'This repository runs this command as one of its checks.',
    help: 'Read the command output; this repository declares the check.',
    settings: [],
    rules: [],
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
        'gspot cannot explain unknown/no-such-rule. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).',
    ],
    ['./missing.sh', 'missing.sh is not a file in this repository.'],
    [
        'unknown-configuration',
        'gspot cannot explain unknown-configuration. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).',
    ],
] as const;
