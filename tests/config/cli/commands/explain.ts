export const EXPLAIN_POLICY = `configurations = []

[scope."api"]
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
        key: 'limits.min_function_statements',
        table: 'limits',
        field: 'min_function_statements',
        root: '3',
        child: '1',
        current: [3, 1],
        owed: [false, true] as const,
    },
    {
        key: 'dependencies.registry_hosts',
        table: 'dependencies',
        field: 'registry_hosts',
        root: '["registry.npmjs.org", "registry.yarnpkg.com"]',
        child: '["registry.example.com"]',
        current: [
            ['registry.npmjs.org', 'registry.yarnpkg.com'],
            ['registry.npmjs.org', 'registry.yarnpkg.com', 'registry.example.com'],
        ],
        owed: [false, true] as const,
    },
    {
        key: 'naming.banned',
        table: 'naming',
        field: 'banned',
        root: '["temporary"]',
        child: '["other"]',
        current: [['temporary'], ['temporary', 'other']],
        owed: [false, false] as const,
    },
];

/** Neutral format and native URL-map fields remain addressable without weakening enforcement. */
export const NEUTRAL_SETTING_VALUES = [
    { key: 'format.indent_style', value: 'tab', root: 'space', child: 'tab' },
    {
        key: 'tools.v8r.schemas',
        value: '{"schema.json":"https://example.com/schema.json"}',
        root: {},
        child: { 'app/schema.json': 'https://example.com/schema.json' },
    },
];
