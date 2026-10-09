export const EXPLAIN_POLICY = `configurations = []

[scope."api"]
configurations = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

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
