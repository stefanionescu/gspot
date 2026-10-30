export const INVALID_LICENSES = ['MTI', 'MIT OR Apache-2.0', 'MIT AND Apache-2.0'];

export const VALID_LICENSES = ['MIT', 'Apache-2.0', 'GPL-2.0+', 'GPL-2.0-only WITH Classpath-exception-2.0'];

export const INVALID_MARKDOWNLINT_NAMES = [
    { name: 'no-hard-tabs', value: { spaces_per_tab: 4 } },
    { name: 'default', value: false },
    { name: 'whitespace', value: {} },
];

export const RULE_OPTION_REASON_TABLES = [
    { name: 'root', tables: '[tools.eslint.rules]\nno-console = [{ allow = ["warn"], reason = true }]\n' },
    {
        name: 'override',
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules.no-console = [{ allow = ["warn"], reason = true }]\n',
    },
    {
        name: 'plugin',
        tables: '[[tools.eslint.plugins]]\nname = "local"\npath = "local.mjs"\nrules.custom = [{ reason = true }]\n',
    },
];

export const DUPLICATED_REASON_ERRORS = [
    {
        key: 'limits.file_lines',
        text: '[limits]\nfile_lines = { value = 400, reason = "x" }\n',
        message:
            'gspot.toml:3: limits.file_lines.reason: limits.file_lines needs a reason of two or more words that says why: "x" is refused.',
    },
    {
        key: 'docs.allowed_urls',
        text: '[docs]\nallowed_urls = { value = ["https://example.com/docs"], reason = "x" }\n',
        message:
            'gspot.toml:3: docs.allowed_urls.reason: docs.allowed_urls needs a reason of two or more words that says why: "x" is refused.',
    },
];

export const KEY_PATH_CASES = [
    {
        name: 'a package tag used as a license version',
        configurations: ['licenses'],
        options: {
            tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "latest"\nreason = "Reviewed its MIT license."\n',
        },
        where: [
            'gspot.toml:4: licenses.allowed_package.0.version: The value "latest" is not valid for licenses.allowed_package.0.version. Name an exact version, a semver range such as ^1.2.0, or * for every version.',
        ],
        correction: ['"latest"', '"^1.2.3"'],
    },
    {
        name: 'an invalid naming override regular expression',
        configurations: ['naming'],
        options: {
            tables: '[[naming.override]]\npaths = ["src/**"]\nignored_names_pattern = "("\nreason = "The library exports these reviewed names."\n',
        },
        where: [
            'gspot.toml:4: naming.override.0.ignored_names_pattern: The value "(" is not valid for naming.override.0.ignored_names_pattern. Use a valid Unicode regular expression.',
        ],
        correction: ['"("', '"^_"'],
    },
    {
        name: 'empty override paths',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = []\nrules = {eqeqeq = ["always"]}\n' },
        correction: ['paths = []', 'paths = ["src"]'],
        where: [
            'gspot.toml:3: tools.eslint.override.0.paths: The value [] is not valid for tools.eslint.override.0.paths. Use a valid list value: ',
        ],
    },
    {
        name: 'numeric rule options',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = ["src"]\nrules = {eqeqeq = 0}\n' },
        correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'],
        where: [
            'gspot.toml:4: tools.eslint.override.0.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
        ],
    },
    {
        name: 'an unknown override field',
        configurations: ['javascript'],
        options: {
            rules: true,
            tables: '[[tools.eslint.override]]\npaths = ["src"]\nrulez = {eqeqeq = ["always"]}\n',
        },
        correction: ['rulez', 'rules'],
        where: [
            'gspot.toml:4: tools.eslint.override.0.rulez: There is no setting called tools.eslint.override.rulez. The settings of [[tools.eslint.override]] are paths, rules, and runtime. Did you mean rules?',
        ],
    },
] as const;

export const UNKNOWN_KEY_CASES = [
    {
        name: 'an unknown nested key',
        text: `
[[scope]]
path = "api"
kitz = []
`,
        message:
            'gspot.toml:4: scope.0.kitz: There is no setting called scope.kitz. The settings of [[scope]] are path, configurations, ',
        correction: ['kitz', 'configurations'] as const,
    },
    {
        name: 'a misspelled key names the closest key',
        text: `[dependencies]
bun_scanners = "@socketsecurity/bun-security-scanner"
`,
        message:
            'gspot.toml:2: dependencies.bun_scanners: There is no setting called dependencies.bun_scanners. The settings of [dependencies] are min_release_age_days, allowed_registries, and bun_scanner. Did you mean bun_scanner?',
        correction: ['bun_scanners', 'bun_scanner'] as const,
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
    'gspot.toml:4: tools.eslint.plugins.0.path: missing-root.mjs names no file. Point path at a file, relative to the repository root.',
    'gspot.toml:5: tools.semgrep.rule_files.0: missing-root.yml names no file. Point rule_files at a file, relative to the repository root.',
    'gspot.toml:9: scope.0.tools.eslint.plugins.0.path: missing-scope.mjs names no file. Point path at a file, relative to the repository root.',
    'gspot.toml:9: scope.0.tools.semgrep.rule_files.0: missing-scope.yml names no file. Point rule_files at a file, relative to the repository root.',
] as const;

export const EMPTY_REASONS = [
    { reason: '', refused: 'an empty reason' },
    { reason: 'because', refused: '"because"' },
    { reason: 'Codex', refused: '"Codex"' },
] as const;

export const INVALID_TOOL_ENUMS = [
    {
        configuration: 'docker',
        tables: '[tools.trivy]\nseverity = ["SEVERE"]\n',
        message:
            'gspot.toml:3: tools.trivy.severity.0: The value "SEVERE" is not valid for tools.trivy.severity.0. Use UNKNOWN or LOW or MEDIUM or HIGH or CRITICAL.',
    },
] as const;

export const SCOPE_CONFIGURATION_SETTINGS = [
    {
        name: 'a sibling configuration does not expose its settings to another scope',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n[scope.tools.sqlfluff]\ndialect = "sqlite"\n',
        messages: [
            'gspot.toml:8: scope.1.tools.sqlfluff.dialect: There is no setting called tools.sqlfluff.dialect in the selected configurations. No setting exists under that table. Run gspot list settings to see every one.',
        ],
    },
    {
        name: 'a selected scope exposes its own configuration settings',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[scope.tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "web"\n',
        messages: [],
    },
    {
        name: 'root settings remain available to a scope that selects their configuration',
        text: 'configurations = ["bash"]\n[tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n',
        messages: [],
    },
] as const;

export const UNKNOWN_TABLE_FIELDS = [
    {
        text: '[format]\nlevel = true\n',
        path: ['format', 'level'],
        message:
            'There is no setting called format.level. The settings of [format] are indent_style, indent_width, print_width, line_ending, final_newline, quotes, trailing_commas, semicolons, and override.',
    },
    {
        text: '[[scope]]\npath = "app"\n[scope.format]\nlevel = true\n',
        path: ['scope', 0, 'format', 'level'],
        message:
            'There is no setting called scope.format.level. The settings of [scope.format] are indent_style, indent_width, print_width, line_ending, final_newline, quotes, trailing_commas, and semicolons.',
    },
    {
        text: '[[tools.eslint.override]]\npaths = ["src/**"]\nlevel = true\n',
        path: ['tools', 'eslint', 'override', 0, 'level'],
        message:
            'There is no setting called tools.eslint.override.level. The settings of [[tools.eslint.override]] are paths, rules, and runtime.',
    },
] as const;

export const CONFIGURATION_CONFLICTS = [
    {
        text: 'configurations = ["bash"]\nremoved_configurations = { value = ["bash"], reason = "External checks cover Bash." }\n',
        path: ['configurations'],
    },
    {
        text: '[[scope]]\npath = "app"\nconfigurations = ["bash"]\nremoved_configurations = { value = ["bash"], reason = "External checks cover Bash." }\n',
        path: ['scope', 0, 'configurations'],
    },
] as const;
