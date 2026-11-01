export const FILES_SANDBOX = {
    configurations: ['data-files'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
} as const;

export const FILES_CASES = [
    {
        check: 'data-files/yaml',
        files: { 'config.yml': 'mode: 0755\n' },
        expected: { file: 'config.yml', line: 1, rule: 'octal-values' },
        corrected: { files: { 'config.yml': 'mode: "0755"\n' } },
    },
    {
        check: 'data-files/taplo-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
        },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    },
    {
        check: 'data-files/xmllint',
        files: { 'settings/feed.xml': '<feed>&missing;</feed>\n' },
        expected: { file: 'settings/feed.xml', line: 1 },
        corrected: { files: { 'settings/feed.xml': '<feed>&amp;</feed>\n' } },
    },
] as const;

export const YAML_SCOPE_TABLES = `[format]
indent_width = 4
[[format.override]]
paths = ["**/*.yml"]
indent_width = 2
[[scope]]
path = "app"
configurations = []
`;

export const YAML_SCOPE_FILES = {
    'settings/project.yml': `parent:
  enabled: true
on:
  enabled: true
`,
    'app/settings/project.yml': `parent:
  enabled: false
on:
  enabled: false
`,
} as const;
