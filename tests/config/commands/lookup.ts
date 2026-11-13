// explain lint rules
export const RULE_PAGES = [
    { check: 'javascript/eslint', rule: 'no-var', tool: 'eslint', key: 'no-var' },
    {
        check: 'javascript/eslint',
        rule: 'gspot/no-trivial-functions',
        tool: '@gspothq/eslint-plugin',
        key: 'no-trivial-functions',
    },
    {
        check: 'javascript/eslint',
        rule: '@typescript-eslint/no-explicit-any',
        tool: 'typescript-eslint',
        key: 'no-explicit-any',
    },
    {
        check: 'javascript/eslint',
        rule: 'n/prefer-global/process',
        tool: 'eslint-plugin-n',
        key: 'prefer-global/process',
    },
    { check: 'css/stylelint', rule: 'color-no-invalid-hex', tool: 'stylelint', key: 'color-no-invalid-hex' },
] as const;
export const UNKNOWN_RULES = [
    ['javascript/eslint', 'no-consolee'],
    ['javascript/eslint', 'n/no-such-rule'],
    ['css/stylelint', 'no-such-rule'],
] as const;

// explain settings
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

// explain subjects
export const PATH_IGNORE = {
    check: 'bash/shellcheck',
    rule: 'SC2086',
    reason: 'The script deliberately splits a list of arguments.',
} as const;
export const EXPLAIN_SETTINGS = `configurations = []

[[scope]]
path = "api"
configurations = ["bash"]

[[ignore]]
check = "${PATH_IGNORE.check}"
rule = "${PATH_IGNORE.rule}"
paths = ["api/build.sh"]
reason = "${PATH_IGNORE.reason}"
`;
export const SYNTAX_CHECK_TABLES =
    '[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "manual"\n';
export const UNKNOWN_SUBJECT_CASES = [
    ['unknown/no-such-rule', 'unknown/no-such-rule'],
    ['./missing.sh', 'missing.sh'],
] as const;

// list scopes
export const LIST_SCOPE_SETTINGS = `configurations = ["bash"]
[limits]
max_file_lines = 250
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.max_file_lines = 200
[[scope]]
path = "api/worker"
configurations = ["sql"]
`;
