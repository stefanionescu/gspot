export const FILES_SANDBOX = {
    configurations: ['files'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yaml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
} as const;

export const FILES_CASES = [
    {
        check: 'files/yamllint',
        files: { 'config.yaml': 'key: 1\nkey: 2\n' },
        expected: { file: 'config.yaml', line: 2, rule: 'key-duplicates' },
        corrected: { files: { 'config.yaml': '---\nkey: 1\n' } },
    },
    {
        check: 'files/taplo-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
            message: 'The file does not parse as TOML, or it is not in the format of the configured TOML settings.',
        },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    },
    {
        check: 'files/xmllint',
        files: { 'settings/feed.xml': '<feed><entry></feed>\n' },
        expected: {
            file: 'settings/feed.xml',
            line: 1,
            message: 'parser error : Opening and ending tag mismatch: entry line 1 and feed',
        },
        corrected: { files: { 'settings/feed.xml': '<feed><entry /></feed>\n' } },
    },
] as const;

/** The truthy setting of each scope must reach the yamllint tool file of that scope. */
export const YAML_SCOPE_SETTINGS = `[format]
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
