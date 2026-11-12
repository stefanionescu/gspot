export const LIST_SCOPE_SETTINGS = `level = "all"
configurations = ["bash", "format", "dependencies"]
test_files = ["checks/**"]
[limits]
max_file_lines = 250
[format]
indent_width = 4
[dependencies]
min_release_age_days = 14
allowed_registries = { value = ["registry.npmjs.org", "registry.example.com"], reason = "The repository resolves packages through both registries." }
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.max_file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.max_file_lines = 30
sql.dialect = "postgres"
`;

export const SHFMT_IGNORE_SETTINGS = {
    tables: `[[ignore]]
check = "bash/shfmt"
reason = "Review this separately."
`,
} as const;

export const RULE_PAGES = [
    ['javascript/eslint', 'no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    [
        'javascript/eslint',
        'gspot/no-trivial-functions',
        'https://generativespotting.com/reference/eslint-plugin/#no-trivial-functions',
    ],
    ['javascript/eslint', '@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'javascript/eslint',
        'n/prefer-global/process',
        'https://github.com/eslint-community/eslint-plugin-n/blob/HEAD/docs/rules/prefer-global/process.md',
    ],
    ['css/stylelint', 'color-no-invalid-hex', 'https://stylelint.io/user-guide/rules/color-no-invalid-hex'],
] as const;

export const UNKNOWN_RULES = [
    ['javascript/eslint', 'no-consolee'],
    ['javascript/eslint', 'n/no-such-rule'],
    ['css/stylelint', 'no-such-rule'],
] as const;

export const RULE_PAGE_SETTINGS = `level = "all"
configurations = ["python"]
[[scope]]
path = "app"
configurations = ["swift"]
`;

export const REASON_VALUES = [
    {
        key: 'limits.max_file_lines',
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

export const EXPLAIN_SETTINGS = `configurations = []

[[scope]]\npath = "api"
configurations = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

export const PATH_IGNORES = [
    {
        check: 'bash/shellcheck',
        rule: 'SC2086',
        reason: 'The script deliberately splits a list of arguments.',
    },
] as const;

export const SYNTAX_CHECK_TABLES =
    '[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "manual"\n';

export const UNKNOWN_SUBJECT_CASES = [
    [
        'unknown/no-such-rule',
        'There is no check, lint rule, configuration, setting, or file called unknown/no-such-rule. Give a check (python/ruff), a lint rule (python/ruff E501), a configuration (python), a setting (limits.max_file_lines), or a file (./src/app.ts).',
    ],
    ['./missing.sh', 'missing.sh is not a file in this repository.'],
] as const;
