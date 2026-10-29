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
        files: { 'config.yaml': 'mode: 0755\n' },
        expected: { file: 'config.yaml', line: 1, rule: 'octal-values' },
        corrected: { files: { 'config.yaml': 'mode: "0755"\n' } },
    },
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
            message: 'Not formatted the way Taplo formats it.',
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
