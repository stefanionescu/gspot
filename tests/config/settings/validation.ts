export const INVALID_SETTING_MESSAGES = [
    {
        name: 'an unknown root key',
        text: '# The repository settings.\nnope = true\n',
        message:
            'gspot.toml:2: nope: nope is not a gspot.toml setting. Did you mean scope? See generativespotting.com/reference/gspot-toml/ for every key.',
    },
    {
        name: 'a wrong root enum type',
        text: '# The repository settings.\nlevel = 5\n',
        message: 'gspot.toml:2: level: The value 5 is not valid for level. Use basic or all.',
    },
    {
        name: 'a wrong numeric setting',
        text: '# The repository settings.\n[format]\nindent_width = "wide"\n',
        message:
            'gspot.toml:3: format.indent_width: The value "wide" is not valid for format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'an unknown scope key',
        text: '# The repository settings.\n[[scope]]\npath = "api"\nkitz = []\n',
        message:
            'gspot.toml:4: scope.0.kitz: kitz is not a field of [[scope]]. The allowed fields are path, configurations, removed_configurations, test_files, format, limits, naming, cloudflare, coverage, dependencies, docs, drizzle, javascript, python, trpc, zustand, licenses, openapi, postgres, secrets, site, spelling, supabase, translations, swift, repository, prose, duplication, xcode, tools, and structure. Did you mean site?',
    },
    {
        name: 'a wrong scope value after another record',
        text: '[[scope]]\npath = "first"\n[[scope]]\npath = "second"\n[scope.format]\nindent_width = "wide"\n',
        message:
            'gspot.toml:6: scope.1.format.indent_width: The value "wide" is not valid for scope.1.format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'a wrong inline reasoned value',
        text: '[limits]\nfile_lines = { value = "large", reason = "The generated source has more lines." }\n',
        message:
            'gspot.toml:2: limits.file_lines.value: The value "large" is not valid for limits.file_lines.value. Use a whole number of 0 or more.',
    },
    {
        name: 'a multiline array item',
        text: 'configurations = [\n"bash",\n12\n]\n',
        message:
            'gspot.toml:3: configurations.1: The value 12 is not valid for configurations.1. Use a valid string value.',
    },
    {
        name: 'a missing record field',
        text: '[[ignore]]\ncheck = "bash/shellcheck"\n',
        message: 'gspot.toml:1: ignore.0.reason: needs a reason. Add reason = "..." to this record.',
    },
] as const;

export const UNSAFE_SCOPE_PATHS = [
    '../outside',
    '/outside',
    'C:outside',
    'C:/absolute',
    'a/../b',
    String.raw`..\outside`,
    String.raw`\\host\share`,
    'bad\0path',
    'api\n/../../outside',
    '',
] as const;

const GSPOT_FOLDER_REFUSAL = 'gspot writes its own files in .gspot. Choose a scope folder outside it.';

const PORTABLE_PATH_REFUSAL = String.raw`Use folder names that work on every system: no empty or dot segment, no \ : < > " | ? * or control character, no name that ends in a dot or a space, and no device name such as nul.`;

export const REFUSED_SCOPE_FOLDERS = [
    { path: '.gspot/tools', message: GSPOT_FOLDER_REFUSAL },
    { path: '.GSPOT', message: GSPOT_FOLDER_REFUSAL },
    { path: 'apps/.gspot/state', message: GSPOT_FOLDER_REFUSAL },
    { path: 'nul.txt', message: PORTABLE_PATH_REFUSAL },
    { path: 'a ', message: PORTABLE_PATH_REFUSAL },
    { path: 'apps/COM1', message: PORTABLE_PATH_REFUSAL },
    { path: 'apps/web.', message: PORTABLE_PATH_REFUSAL },
    { path: 'apps//web', message: PORTABLE_PATH_REFUSAL },
    { path: 'apps/./web', message: PORTABLE_PATH_REFUSAL },
    { path: 'apps/a<b', message: PORTABLE_PATH_REFUSAL },
] as const;

export const UNTIL_DATE_CASES = [
    { name: 'ordinary date', literal: '2026-12-31', valid: true, date: '2026-12-31' },
    { name: 'quoted date', literal: '"2026-12-31"', valid: false },
    { name: 'local datetime', literal: '2026-12-31T00:00:00', valid: false },
    { name: 'offset datetime', literal: '2026-12-31T00:00:00Z', valid: false },
    { name: 'local time', literal: '00:00:00', valid: false },
] as const;

export const SETTING_RULE_OPTIONS = [
    {
        tables: '[tools.eslint.rules]\ncomplexity = [40]\n',
        path: 'tools.eslint.rules.complexity',
        line: 3,
        rule: 'complexity',
        setting: 'limits.cyclomatic_complexity',
    },
    {
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules = { max-lines = [{ max = 900 }] }\n',
        path: 'tools.eslint.override.0.rules.max-lines',
        line: 4,
        rule: 'max-lines',
        setting: 'limits.file_lines',
    },
    {
        tables: '[[scope]]\npath = "app"\n[scope.tools.eslint.rules]\n"sonarjs/no-identical-functions" = [50]\n',
        path: 'scope.0.tools.eslint.rules.sonarjs/no-identical-functions',
        line: 5,
        rule: 'sonarjs/no-identical-functions',
        setting: 'duplication.min_lines',
    },
] as const;

export const REFUSED_RULE_OPTIONS = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        toml: '[tools.commitlint.rules]\nheader-max-length = 0\n',
        message:
            'gspot.toml:4: tools.commitlint.rules.header-max-length: This table holds options only, without a severity; the level decides which rules run. To turn header-max-length off, run gspot ignore commits/commitlint --rule header-max-length --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "error"\n',
        message:
            'gspot.toml:4: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\nMD041 = true\n',
        message:
            'gspot.toml:4: tools.markdownlint.rules.MD041: This table holds options only, without a severity; the level decides which rules run. To turn MD041 off, run gspot ignore markdown/markdownlint --rule MD041 --reason "<why>".',
    },
    {
        tool: 'markdownlint',
        configuration: 'markdown',
        toml: '[tools.markdownlint.rules]\ndefault = {}\n',
        message:
            'gspot.toml:4: tools.markdownlint.rules.default: Name a rule by its ID, such as MD010 = { spaces_per_tab = 4 }. This table holds rule options only.',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n',
        message:
            'gspot.toml:4: tools.stylelint.rules.color-hex-length: This table holds options only, without a severity; the level decides which rules run. To turn color-hex-length off, run gspot ignore css/stylelint --rule color-hex-length --reason "<why>".',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = true\n',
        message:
            'gspot.toml:4: tools.yamllint.rules.truthy: This table holds options only, without a severity; the level decides which rules run. To turn truthy off, run gspot ignore data-files/yamllint --rule truthy --reason "<why>".',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        toml: '[tools.yamllint.rules]\ntruthy = { ignore = "**" }\n',
        message:
            'gspot.toml:4: tools.yamllint.rules.truthy: This table holds options only, without a severity; the level decides which rules run. To turn truthy off, run gspot ignore data-files/yamllint --rule truthy --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "off"\n',
        message:
            'gspot.toml:4: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = "warn"\n',
        message:
            'gspot.toml:4: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = 0\n',
        message:
            'gspot.toml:4: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'eslint',
        configuration: 'javascript',
        toml: '[tools.eslint.rules]\neqeqeq = false\n',
        message:
            'gspot.toml:4: tools.eslint.rules.eqeqeq: This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".',
    },
    {
        tool: 'stylelint',
        configuration: 'css',
        toml: '[tools.stylelint.rules]\ncolor-named = false\n',
        message:
            'gspot.toml:4: tools.stylelint.rules.color-named: This table holds options only, without a severity; the level decides which rules run. To turn color-named off, run gspot ignore css/stylelint --rule color-named --reason "<why>".',
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
            'gspot.toml:4: coverage.swift_target.0.reason: A Swift target with a lower line minimum than coverage.lines needs a reason.',
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
