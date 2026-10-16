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
