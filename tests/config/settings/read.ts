import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const INVALID_LICENSES = ['MTI', 'MIT OR Apache-2.0', 'MIT AND Apache-2.0'];

export const VALID_LICENSES = ['MIT', 'Apache-2.0', 'GPL-2.0+', 'GPL-2.0-only WITH Classpath-exception-2.0'];

export const DUPLICATED_REASON_ERRORS = [
    {
        key: 'limits.file_lines',
        text: '[limits]\nfile_lines = { value = 400, reason = "x" }\n',
        message:
            'gspot.toml: limits.file_lines.reason: limits.file_lines needs a reason that says something: "x" is refused. Write one sentence saying why.',
    },
    {
        key: 'docs.allowed_urls',
        text: '[docs]\nallowed_urls = { value = ["https://example.com/docs"], reason = "x" }\n',
        message:
            'gspot.toml: docs.allowed_urls.reason: docs.allowed_urls needs a reason that says something: "x" is refused. Write one sentence saying why.',
    },
];

export const KEY_PATH_CASES = [
    {
        name: 'a multiline array value',
        text: `configurations = [
"bash",
12
]
`,
        where: ['configurations.1'],
        correction: ['12', '"data-files"'],
    },
    {
        name: 'empty override paths',
        text: buildSandboxSettings(['javascript'], {
            rules: true,
            tables: '[[tools.eslint.override]]\npaths = []\nrules = {eqeqeq = ["always"]}\n',
        }),
        correction: ['paths = []', 'paths = ["src"]'],
        where: ['tools.eslint.override.0.paths:'],
    },
    {
        name: 'numeric rule options',
        text: buildSandboxSettings(['javascript'], {
            rules: true,
            tables: '[[tools.eslint.override]]\npaths = ["src"]\nrules = {eqeqeq = 0}\n',
        }),
        correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'],
        where: ['tools.eslint.override.0.rules.eqeqeq:'],
    },
    {
        name: 'boolean rule options',
        text: buildSandboxSettings(['javascript'], {
            rules: true,
            tables: '[[tools.eslint.override]]\npaths = ["src"]\nrules = {eqeqeq = true}\n',
        }),
        correction: ['eqeqeq = true', 'eqeqeq = ["always"]'],
        where: ['tools.eslint.override.0.rules.eqeqeq:'],
    },
    {
        name: 'an unknown override field',
        text: buildSandboxSettings(['javascript'], {
            rules: true,
            tables: '[[tools.eslint.override]]\npaths = ["src"]\nrulez = {eqeqeq = ["always"]}\n',
        }),
        correction: ['rulez', 'rules'],
        where: ['[tools.eslint.override.0]: `rulez` is not a gspot.toml setting.'],
    },
] as const;

export const UNKNOWN_KEY_CASES = [
    {
        name: 'an unknown key names its table',
        text: `configurations = ["bash"]
[hooks]
enabled = true
psh = "all"
`,
        message: '[hooks]: `psh` is not a gspot.toml setting.',
        correction: ['psh = "all"\n', ''] as const,
    },
    {
        name: 'an unknown nested key',
        text: `
[[scope]]
path = "api"
kitz = []
`,
        message: '[[scope]] record 1: `kitz` is not a gspot.toml setting.',
        correction: ['kitz', 'configurations'] as const,
    },
    {
        name: 'a renamed key names the key that is close to it',
        text: `[dependencies]
scanner = "@socketsecurity/bun-security-scanner"
`,
        message: '[dependencies]: `scanner` is not a gspot.toml setting. Did you mean `bun_scanner`?',
        correction: ['scanner', 'bun_scanner'] as const,
    },
] as const;

export const RULE_FILE_SETTINGS = {
    configurations: ['javascript', 'security'],
    tools: {
        eslint: { plugins: [{ name: 'root', path: 'missing-root.mjs', rules: {} }] },
        semgrep: { rule_files: ['missing-root.yml', 'present.yml'] },
    },
    scope: [
        {
            path: 'app',
            tools: {
                eslint: { plugins: [{ name: 'local', path: 'missing-scope.mjs', rules: {} }] },
                semgrep: { rule_files: ['missing-scope.yml', 'present.yml'] },
            },
        },
    ],
} as const;

export const RULE_FILE_ERRORS = [
    'gspot.toml: tools.eslint.plugins.0.path: `missing-root.mjs` names no file. Point path at a file, relative to the repository root.',
    'gspot.toml: tools.semgrep.rule_files.0: `missing-root.yml` names no file. Point rule_files at a file, relative to the repository root.',
    'gspot.toml: scope.0.tools.eslint.plugins.0.path: `missing-scope.mjs` names no file. Point path at a file, relative to the repository root.',
    'gspot.toml: scope.0.tools.semgrep.rule_files.0: `missing-scope.yml` names no file. Point rule_files at a file, relative to the repository root.',
] as const;

export const EMPTY_REASONS = [
    { reason: '', refused: 'an empty reason' },
    { reason: 'because', refused: '"because"' },
    { reason: 'Codex', refused: '"Codex"' },
] as const;
