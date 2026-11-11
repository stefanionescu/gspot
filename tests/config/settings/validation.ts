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

export const INVALID_SETTING_LOCATIONS = [
    {
        name: 'a plugin version with a v prefix',
        text: 'configurations = ["css"]\n[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "v1.2.3"\nrules = {}\n',
        where: 'gspot.toml:4: tools.stylelint.plugins.0.version: The value "v1.2.3" is not valid for tools.stylelint.plugins.0.version. Use an exact version, such as 1.2.3.',
    },
    {
        name: 'a record list of an unknown table',
        text: 'level = "all"\n\n[[naming.absent]]\npaths = ["first/**"]\n\n[[naming.absent]]\npaths = ["second/**"]\n',
        where: 'gspot.toml:3: naming.absent: There is no setting called naming.absent. The settings that exist under that table are naming.max_characters, naming.max_words, naming.cases, naming.banned_words, naming.terms, naming.exception, naming.typescript, naming.python and 5 more.',
    },
    {
        name: 'an unknown root key',
        text: '# The repository settings.\nnope = true\n',
        where: 'gspot.toml:2: nope: There is no setting called nope. The settings that exist at the top level are level, tool_timeout_seconds, test_files, configurations, removed_configurations, format, limits, naming and 32 more.',
    },
    {
        name: 'a wrong root enum type',
        text: '# The repository settings.\nlevel = 5\n',
        where: 'gspot.toml:2: level: The value 5 is not valid for level. Use basic or all.',
    },
    {
        name: 'a wrong numeric setting',
        text: '# The repository settings.\n[format]\nindent_width = "wide"\n',
        where: 'gspot.toml:3: format.indent_width: The value "wide" is not valid for format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'a wrong scope value after another record',
        text: '[[scope]]\npath = "first"\n[[scope]]\npath = "second"\n[scope.format]\nindent_width = "wide"\n',
        where: 'gspot.toml:6: scope.1.format.indent_width: The value "wide" is not valid for scope.1.format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'a wrong inline reasoned value',
        text: '[limits]\nmax_file_lines = { value = "large", reason = "The generated source has more lines." }\n',
        where: 'gspot.toml:2: limits.max_file_lines.value: The value "large" is not valid for limits.max_file_lines.value. Use a whole number of 0 or more.',
    },
] as const;

const RELATIVE_PATH_GUIDANCE = 'Use a relative path with forward slashes, without parent traversal or a drive prefix.';

const GSPOT_FOLDER_GUIDANCE = 'gspot writes its own files in .gspot. Choose a scope folder outside it.';

const PORTABLE_NAME_GUIDANCE = String.raw`Use folder names that work on every system: no empty or dot segment, no \ : < > " | ? * or control character, no name that ends in a dot or a space, and no device name such as nul.`;

export const REFUSED_SCOPE_PATHS = [
    ['../outside', RELATIVE_PATH_GUIDANCE],
    ['/outside', RELATIVE_PATH_GUIDANCE],
    ['C:/absolute', RELATIVE_PATH_GUIDANCE],
    [String.raw`\\host\share`, RELATIVE_PATH_GUIDANCE],
    ['bad\0path', RELATIVE_PATH_GUIDANCE],
    ['', RELATIVE_PATH_GUIDANCE],
    ['.gspot/tools', GSPOT_FOLDER_GUIDANCE],
    ['.GSPOT', GSPOT_FOLDER_GUIDANCE],
    ['nul.txt', PORTABLE_NAME_GUIDANCE],
    ['a ', PORTABLE_NAME_GUIDANCE],
    ['apps//web', PORTABLE_NAME_GUIDANCE],
    ['apps/a<b', PORTABLE_NAME_GUIDANCE],
] as const;

export const SETTING_RULE_OPTIONS = [
    {
        tables: '[tools.eslint.rules]\ncomplexity = [40]\n',
        rule: 'complexity',
        setting: 'limits.max_cyclomatic_complexity',
        where: 'gspot.toml:3: tools.eslint.rules.complexity: gspot writes the options of complexity from limits.max_cyclomatic_complexity. Change that setting instead: gspot set limits.max_cyclomatic_complexity <value>, with --reason when you raise it.',
    },
    {
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules = { max-lines = [{ max = 900 }] }\n',
        rule: 'max-lines',
        setting: 'limits.max_file_lines',
        where: 'gspot.toml:4: tools.eslint.override.0.rules.max-lines: gspot writes the options of max-lines from limits.max_file_lines. Change that setting instead: gspot set limits.max_file_lines <value>, with --reason when you raise it.',
    },
    {
        tables: '[[scope]]\npath = "app"\n[scope.tools.eslint.rules]\n"gspot/no-identical-functions" = [50]\n',
        rule: 'gspot/no-identical-functions',
        setting: 'structure.min_duplicate_lines',
        where: 'gspot.toml:5: scope.0.tools.eslint.rules.gspot/no-identical-functions: gspot writes the options of gspot/no-identical-functions from structure.min_duplicate_lines. Change that setting instead: gspot set structure.min_duplicate_lines <value>, with --reason when you raise it.',
    },
] as const;

export const REFUSED_RULE_OPTIONS = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        toml: '[tools.commitlint.rules]\nheader-max-length = 0\n',
        where: 'gspot.toml:3: tools.commitlint.rules.header-max-length: This table holds options only, without a severity; the level decides which rules run. To ignore header-max-length, run gspot ignore commits/commitlint --rule header-max-length --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "error"\n',
        where: 'gspot.toml:3: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To ignore eqeqeq, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\nMD041 = true\n',
        where: 'gspot.toml:3: tools.markdownlint.rules.MD041: This table holds options only, without a severity; the level decides which rules run. To ignore MD041, run gspot ignore markdown/markdownlint --rule MD041 --reason "<why>".',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n',
        where: 'gspot.toml:3: tools.stylelint.rules.color-hex-length: This table holds options only, without a severity; the level decides which rules run. To ignore color-hex-length, run gspot ignore css/stylelint --rule color-hex-length --reason "<why>".',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-named = false\n',
        where: 'gspot.toml:3: tools.stylelint.rules.color-named: This table holds options only, without a severity; the level decides which rules run. To ignore color-named, run gspot ignore css/stylelint --rule color-named --reason "<why>".',
    },
] as const;

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
