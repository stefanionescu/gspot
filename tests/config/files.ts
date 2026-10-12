export const FILES_SANDBOX = {
    configurations: ['files'],

    tools: ['taplo', 'yamllint'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yaml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
} as const;

export const FILES_CASES = [
    {
        check: 'files/taplo',
        files: { 'settings.toml': 'a = 1\n[x\n' },
        expected: { file: 'settings.toml', line: 2 },
        corrected: { files: { 'settings.toml': 'a = 1\n' } },
    },
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
            message: 'The file is not formatted with the configured TOML settings.',
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

/** Scoped truthy policies must reach their matching native YAML configuration. */
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

/** Two-space formatting and consumer-owned on keys stay valid in each project. */
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

/** A child value accepted only by the root reveals leaked native options. */
export const YAML_SCOPE_SAMPLE = `parent:
  enabled: yes
on:
  enabled: no
`;

export const EXECUTABLE_MODE = 0o755;

export const EXECUTABLE_BITS = 0o111;

/** The archive fields for the Python wheel. */
export const ZIP_LAYOUT = {
    local: {
        size: 30,
        signature: 0x04_03_4b_50,
        version: 20,
        versionOffset: 4,
        crcOffset: 14,
        compressedSizeOffset: 18,
        sizeOffset: 22,
        nameLengthOffset: 26,
    },
    central: {
        size: 46,
        signature: 0x02_01_4b_50,
        version: 0x03_14,
        versionOffset: 4,
        localCopyOffset: 6,
        localStart: 4,
        localEnd: 28,
        modeOffset: 38,
        localOffset: 42,
    },
    unix: { executable: 0o10_0755, regular: 0o10_0644, modeShift: 16 },
    end: {
        size: 22,
        signature: 0x06_05_4b_50,
        diskCountOffset: 8,
        countOffset: 10,
        sizeOffset: 12,
        directoryOffset: 16,
    },
} as const;
