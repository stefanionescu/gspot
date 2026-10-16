export const KEY_PATH_CASES = [
    {
        name: 'a multiline array value',
        text: `configurations = [
"bash",
12
]
`,
        where: ['configurations.1'],
        messages: [],
        correction: ['12', '"files"'],
    },
] as const;

/** Unknown keys name their table; the corrected input then passes. */
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
] as const;

export const REFUSED_RULE_OPTIONS = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        toml: '[tools.commitlint.rules]\nheader-max-length = 0\n',
        message: 'Commitlint rule selection',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "error"\n',
        message: 'ESLint rule selection',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\nMD041 = true\n',
        message: 'Markdownlint rule selection',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\ndefault = {}\n',
        message: 'Markdownlint rule selection',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n',
        message: 'Stylelint rule selection',
    },
    {
        tool: 'shellcheck',
        configuration: 'bash',
        toml: '[tools.shellcheck]\nextra = { value = { disable = "SC2086" }, reason = "This option is reviewed." }\n',
        message: 'ShellCheck rule selection',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = true\n',
        message: 'Yamllint rule selection',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = { ignore = "**" }\n',
        message: 'Yamllint rule selection',
    },
] as const;

export const REVIEWED_REASON = 'Reviewed in tests.';
