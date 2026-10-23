export const FILES_SANDBOX = {
    configurations: ['data-files'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yaml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
} as const;

export const FILES_CASES = [
    {
        check: 'data-files/yamllint',
        files: { 'config.yaml': 'key: 1\nkey: 2\n' },
        expected: { file: 'config.yaml', line: 2, rule: 'key-duplicates' },
        corrected: { files: { 'config.yaml': '---\nkey: 1\n' } },
    },
    {
        check: 'data-files/taplo-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
            message: 'The file does not parse as TOML, or it is not in the format of the configured TOML settings.',
        },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    },
    {
        check: 'data-files/xmllint',
        files: { 'settings/feed.xml': '<feed>&missing;</feed>\n' },
        expected: { file: 'settings/feed.xml', line: 1, message: "parser error : Entity 'missing' not defined" },
        corrected: { files: { 'settings/feed.xml': '<feed>&amp;</feed>\n' } },
    },
] as const;

/** The truthy setting of each scope must reach the yamllint config file of that scope. */
export const YAML_SCOPE_TABLES = `[format]
indent_width = 4
[[format.override]]
paths = ["**/*.yaml"]
indent_width = 2
[tools.yamllint.rules]
truthy = { allowed-values = ["yes"] }
[[scope]]
path = "app"
configurations = []
[scope.tools.yamllint.rules]
truthy = { allowed-values = ["no"] }
`;

/** Two-space indents and `on` keys pass in each project. */
export const YAML_SCOPE_FILES = {
    'settings/project.yaml': `parent:
  enabled: yes
on:
  enabled: yes
`,
    'app/settings/project.yaml': `parent:
  enabled: no
on:
  enabled: no
`,
} as const;

/** A child value that only the root accepts, to catch root options that leak into the child. */
export const YAML_SCOPE_SAMPLE = `parent:
  enabled: yes
on:
  enabled: no
`;

/** A gspot.toml whose ignore has an unquoted until date, which v8r must accept. */
export const UNQUOTED_UNTIL_CHANGE = {
    check: 'data-files/v8r',
    files: {},
    settings: '\n[[ignore]]\ncheck = "data-files/yamllint"\nreason = "The sample holds no YAML."\nuntil = 2099-01-01\n',
} as const;

/** A JSON Schema that rejects every document. */
export const REJECTING_SCHEMA = '{ "not": {} }\n';
