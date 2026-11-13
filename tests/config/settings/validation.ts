import { SCOPE_PATH_MESSAGES } from '#cli/config/settings/schema.ts';

// key validation
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

// published schema
export const PUBLISHED_SCHEMA_CASES = [
    { name: 'escaped glob brackets', input: { test_files: [String.raw`src/\[draft\]/*.test.ts`] }, valid: true },
    { name: 'a path with an ASCII control character', input: { test_files: ['src/\u{1}.test.ts'] }, valid: false },
    { name: 'a path with a C1 control character', input: { test_files: ['src/\u{85}.test.ts'] }, valid: false },
    { name: 'a path with an invalid escape', input: { test_files: [String.raw`src/\a.test.ts`] }, valid: false },
    {
        name: 'GitHub CI with systems',
        input: { ci: { provider: 'github', operating_systems: ['linux'] } },
        valid: true,
    },
    { name: 'GitLab CI without systems', input: { ci: { provider: 'gitlab' } }, valid: true },
    { name: 'a shipped configuration name', input: { configurations: ['python'] }, valid: true },
    { name: 'an unknown configuration name', input: { configurations: ['cobol'] }, valid: false },
    {
        name: 'an unknown configuration name in a scope',
        input: { scope: [{ path: 'api', configurations: ['cobol'] }] },
        valid: false,
    },
    {
        name: 'GitLab CI with systems',
        input: { ci: { provider: 'gitlab', operating_systems: ['linux'] } },
        valid: false,
    },
    {
        name: 'GitLab CI with an empty systems list',
        input: { ci: { provider: 'gitlab', operating_systems: [] } },
        valid: false,
    },
    {
        name: 'an empty command',
        input: { command_check: [{ id: 'project/lint', command: [], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty program',
        input: { command_check: [{ id: 'project/lint', command: [''], paths: ['src/**'], stage: 'commit' }] },
        valid: false,
    },
    {
        name: 'an empty argument',
        input: { command_check: [{ id: 'project/lint', command: ['lint', ''], paths: ['src/**'], stage: 'commit' }] },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { override: [{ paths: ['src/**'] }] } },
        valid: false,
    },
    {
        name: 'an allowed package with a version range',
        input: {
            configurations: ['licenses'],
            licenses: {
                allowed_package: [{ name: 'example', version: '^1.2.3', reason: 'Reviewed its MIT license.' }],
            },
        },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
    },
    {
        name: 'reasoned registry hosts',
        input: {
            dependencies: {
                allowed_registries: { value: ['registry.example.test'], reason: 'Reviewed the package registry.' },
            },
        },
        valid: true,
    },
    {
        name: 'invalid registry host',
        input: { dependencies: { allowed_registries: { value: [false], reason: 'Reviewed the package registry.' } } },
        valid: false,
    },
] as const;

// reason validation
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

// schema validation
export const BOUNDARY_IMPORT_RULES = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]
can_import = ["storage"]
`;
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
