import { buildSandboxSettings } from '#tests/setup/settings.ts';

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
    {
        name: 'a renamed key names the key that is close to it',
        text: `[dependencies]
scanner = "@socketsecurity/bun-security-scanner"
`,
        message: '[dependencies]: `scanner` is not a gspot.toml setting. Did you mean `bun_scanner`?',
        correction: ['scanner', 'bun_scanner'] as const,
    },
] as const;

export const REFUSED_RULE_OPTIONS = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        toml: '[tools.commitlint.rules]\nheader-max-length = 0\n',
        message:
            'gspot.toml: tools.commitlint.rules.header-max-length: This table holds options only, without a severity; the level decides which rules run. To turn header-max-length off, run gspot ignore commits/commitlint --rule header-max-length --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "error"\n',
        message:
            'gspot.toml: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\nMD041 = true\n',
        message:
            'gspot.toml: tools.markdownlint.rules.MD041: This table holds options only, without a severity; the level decides which rules run. To turn MD041 off, run gspot ignore markdown/markdownlint --rule MD041 --reason "<why>".',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\ndefault = {}\n',
        message:
            'gspot.toml: tools.markdownlint.rules.default: This table holds options only, without a severity; the level decides which rules run. To turn default off, run gspot ignore markdown/markdownlint --rule default --reason "<why>".',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n',
        message:
            'gspot.toml: tools.stylelint.rules.color-hex-length: This table holds options only, without a severity; the level decides which rules run. To turn color-hex-length off, run gspot ignore css/stylelint --rule color-hex-length --reason "<why>".',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = true\n',
        message:
            'gspot.toml: tools.yamllint.rules.truthy: This table holds options only, without a severity; the level decides which rules run. To turn truthy off, run gspot ignore data-files/yamllint --rule truthy --reason "<why>".',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = { ignore = "**" }\n',
        message:
            'gspot.toml: tools.yamllint.rules.truthy: This table holds options only, without a severity; the level decides which rules run. To turn truthy off, run gspot ignore data-files/yamllint --rule truthy --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "off"\n',
        message:
            'gspot.toml: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "warn"\n',
        message:
            'gspot.toml: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = 0\n',
        message:
            'gspot.toml: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = false\n',
        message:
            'gspot.toml: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-named = false\n',
        message:
            'gspot.toml: tools.stylelint.rules.color-named: This table holds options only, without a severity; the level decides which rules run. To turn color-named off, run gspot ignore css/stylelint --rule color-named --reason "<why>".',
    },
] as const;

export const REVIEWED_REASON = 'Reviewed in tests.';

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
