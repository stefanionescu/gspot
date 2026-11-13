import { SCOPE_PATH_MESSAGES } from '#cli/config/settings/file.ts';

// key validation
export const INVALID_MARKDOWNLINT_NAMES = [
    { name: 'no-hard-tabs', value: { spaces_per_tab: 4 } },
    { name: 'default', value: false },
    { name: 'whitespace', value: {} },
];
export const SCOPE_CONFIGURATION_SETTINGS = [
    {
        name: 'a sibling configuration does not expose its settings to another scope',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n[scope.sql]\ndialect = "sqlite"\n',
        errors: ['gspot.toml:8: scope.1.sql.dialect:'],
    },
    {
        name: 'a selected scope exposes its own configuration settings',
        text: 'configurations = ["bash"]\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[scope.sql]\ndialect = "sqlite"\n[[scope]]\npath = "web"\n',
        errors: [],
    },
    {
        name: 'root settings remain available to a scope that selects their configuration',
        text: 'configurations = ["bash"]\n[sql]\ndialect = "sqlite"\n[[scope]]\npath = "database"\nconfigurations = ["sql"]\n[[scope]]\npath = "web"\n',
        errors: [],
    },
] as const;

// reason validation
export const DUPLICATED_REASON_ERRORS = [
    {
        key: 'limits.max_file_lines',
        text: '[limits]\nmax_file_lines = { value = 400, reason = "x" }\n',
    },
    {
        key: 'docs.allowed_urls',
        text: '[docs]\nallowed_urls = { value = ["https://example.com/docs"], reason = "x" }\n',
    },
];
export const EMPTY_REASONS = ['', 'because'] as const;
export const REVIEWED_REASON = 'Reviewed in tests.';
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
export const SWIFT_TARGET_REASON_CASES = [
    {
        name: 'a lower limit without a reason',
        lines: 60,
        reason: '',
        errors: [
            'gspot.toml:4: coverage.swift_target.0.reason: A Swift target with a lower line minimum than coverage.min_line_percent needs a reason.',
        ],
    },
    {
        name: 'a lower limit with a reason',
        lines: 60,
        reason: '\nreason = "The generated platform glue cannot be exercised directly."',
        errors: [],
    },
    { name: 'the shared limit without a reason', lines: 80, reason: '', errors: [] },
] as const;

// rule file validation
export const RULE_FILE_ERRORS = [
    'gspot.toml:4: tools.eslint.plugins.0.path: missing-root.mjs',
    'gspot.toml:5: tools.stylelint.plugins.0.path: missing-root.mjs',
    'gspot.toml:8: security.semgrep_rules.0: missing-root.yml',
    'gspot.toml:12: scope.0.tools.eslint.plugins.0.path: missing-scope.mjs',
    'gspot.toml:13: scope.0.security.semgrep_rules.0: missing-scope.yml',
] as const;
export const RULE_FILE_SETTINGS = {
    configurations: ['javascript', 'security', 'css'],
    tools: {
        eslint: { plugins: [{ name: 'root', path: 'missing-root.mjs', rules: {} }] },
        stylelint: { plugins: [{ path: 'missing-root.mjs', rules: {} }] },
    },
    security: { semgrep_rules: ['missing-root.yml', 'present.yml'] },
    scope: [
        {
            path: 'app',
            tools: { eslint: { plugins: [{ name: 'local', path: 'missing-scope.mjs', rules: {} }] } },
            security: { semgrep_rules: ['missing-scope.yml', 'present.yml'] },
        },
    ],
} as const;

// schema validation
export const BOUNDARY_IMPORT_RULES = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]
can_import = ["storage"]
`;
export const INVALID_LICENSES = ['MTI', 'MIT OR Apache-2.0'];
export const ORDERED_IMPORT_RULES = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]

[[import_rule]]
name = "entry"
paths = ["entry/**"]
`;
export const REFUSED_RULE_OPTIONS = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        toml: '[tools.commitlint.rules]\nheader-max-length = 0\n',
        start: 'gspot.toml:3: tools.commitlint.rules.header-max-length:',
        command: 'gspot ignore commits/commitlint --rule header-max-length',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "error"\n',
        start: 'gspot.toml:3: tools.eslint.rules.eqeqeq:',
        command: 'gspot ignore javascript/eslint --rule eqeqeq',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\nMD041 = true\n',
        start: 'gspot.toml:3: tools.markdownlint.rules.MD041:',
        command: 'gspot ignore markdown/markdownlint --rule MD041',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n',
        start: 'gspot.toml:3: tools.stylelint.rules.color-hex-length:',
        command: 'gspot ignore css/stylelint --rule color-hex-length',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-named = false\n',
        start: 'gspot.toml:3: tools.stylelint.rules.color-named:',
        command: 'gspot ignore css/stylelint --rule color-named',
    },
] as const;
const RELATIVE_PATH_GUIDANCE = 'Use a relative path with forward slashes, without parent traversal or a drive prefix.';
export const REFUSED_SCOPE_PATHS = [
    ['../outside', RELATIVE_PATH_GUIDANCE],
    ['/outside', RELATIVE_PATH_GUIDANCE],
    ['C:/absolute', RELATIVE_PATH_GUIDANCE],
    [String.raw`\\host\share`, RELATIVE_PATH_GUIDANCE],
    ['bad\0path', RELATIVE_PATH_GUIDANCE],
    ['', RELATIVE_PATH_GUIDANCE],
    ['.gspot/tools', SCOPE_PATH_MESSAGES.gspot],
    ['.GSPOT', SCOPE_PATH_MESSAGES.gspot],
    ['nul.txt', SCOPE_PATH_MESSAGES.portable],
    ['a ', SCOPE_PATH_MESSAGES.portable],
    ['apps//web', SCOPE_PATH_MESSAGES.portable],
    ['apps/a<b', SCOPE_PATH_MESSAGES.portable],
] as const;
export const VALID_LICENSES = ['MIT', 'GPL-2.0-only WITH Classpath-exception-2.0'];

// setting rules
export const SETTING_RULE_OPTIONS = [
    {
        tables: '[tools.eslint.rules]\ncomplexity = [40]\n',
        rule: 'complexity',
        setting: 'limits.max_cyclomatic_complexity',
        start: 'gspot.toml:3: tools.eslint.rules.complexity:',
    },
    {
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules = { max-lines = [{ max = 900 }] }\n',
        rule: 'max-lines',
        setting: 'limits.max_file_lines',
        start: 'gspot.toml:4: tools.eslint.override.0.rules.max-lines:',
    },
    {
        tables: '[[scope]]\npath = "app"\n[scope.tools.eslint.rules]\n"gspot/no-identical-functions" = [50]\n',
        rule: 'gspot/no-identical-functions',
        setting: 'structure.min_duplicate_lines',
        start: 'gspot.toml:5: scope.0.tools.eslint.rules.gspot/no-identical-functions:',
    },
] as const;

// validation messages
export const INVALID_SETTING_LOCATIONS = [
    {
        name: 'a plugin version with a v prefix',
        text: 'configurations = ["css"]\n[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "v1.2.3"\nrules = {}\n',
        start: 'gspot.toml:4: tools.stylelint.plugins.0.version:',
    },
    {
        name: 'a record list of an unknown table',
        text: 'level = "all"\n\n[[naming.absent]]\npaths = ["first/**"]\n\n[[naming.absent]]\npaths = ["second/**"]\n',
        start: 'gspot.toml:3: naming.absent: There is no setting called naming.absent.',
    },
    {
        name: 'an unknown root key',
        text: '# The repository settings.\nnope = true\n',
        start: 'gspot.toml:2: nope: There is no setting called nope.',
    },
    {
        name: 'a wrong root enum type',
        text: '# The repository settings.\nlevel = 5\n',
        start: 'gspot.toml:2: level:',
    },
    {
        name: 'a wrong numeric setting',
        text: '# The repository settings.\n[format]\nindent_width = "wide"\n',
        start: 'gspot.toml:3: format.indent_width:',
    },
    {
        name: 'a wrong scope value after another record',
        text: '[[scope]]\npath = "first"\n[[scope]]\npath = "second"\n[scope.format]\nindent_width = "wide"\n',
        start: 'gspot.toml:6: scope.1.format.indent_width:',
    },
    {
        name: 'a wrong inline reasoned value',
        text: '[limits]\nmax_file_lines = { value = "large", reason = "The generated source has more lines." }\n',
        start: 'gspot.toml:2: limits.max_file_lines.value:',
    },
] as const;
export const KEY_PATH_CASES = [
    {
        name: 'a package tag used as a license version',
        configurations: ['licenses'],
        options: {
            tables: '[[licenses.allowed_package]]\nname = "example"\nversion = "latest"\nreason = "Reviewed its MIT license."\n',
        },
        start: 'gspot.toml:4: licenses.allowed_package.0.version:',
        correction: ['"latest"', '"^1.2.3"'],
    },
    {
        name: 'an invalid naming exception regular expression',
        configurations: ['naming'],
        options: {
            tables: '[[naming.exception]]\npaths = ["src/**"]\nignored_names_pattern = "("\nreason = "The library exports these reviewed names."\n',
        },
        start: 'gspot.toml:4: naming.exception.0.ignored_names_pattern:',
        correction: ['"("', '"^_"'],
    },
    {
        name: 'empty override paths',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = []\nrules = {eqeqeq = ["always"]}\n' },
        correction: ['paths = []', 'paths = ["src"]'],
        start: 'gspot.toml:3: tools.eslint.override.0.paths: The value [] is not valid for tools.eslint.override.0.paths.',
    },
    {
        name: 'numeric rule options',
        configurations: ['javascript'],
        options: { rules: true, tables: '[[tools.eslint.override]]\npaths = ["src"]\nrules = {eqeqeq = 0}\n' },
        correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'],
        start: 'gspot.toml:4: tools.eslint.override.0.rules.eqeqeq:',
    },
] as const;
