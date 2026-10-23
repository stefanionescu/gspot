export const UNSAFE_SCOPE_PATHS = [
    '../outside',
    '/outside',
    'C:outside',
    String.raw`..\outside`,
    String.raw`\\host\share`,
    'bad\0path',
    'api\n/../../outside',
    '',
] as const;

export const UNTIL_DATE_CASES = [
    { name: 'ordinary date', literal: '2026-12-31', valid: true, date: '2026-12-31' },
    { name: 'quoted date', literal: '"2026-12-31"', valid: false },
    { name: 'local datetime', literal: '2026-12-31T00:00:00', valid: false },
    { name: 'offset datetime', literal: '2026-12-31T00:00:00Z', valid: false },
    { name: 'local time', literal: '00:00:00', valid: false },
] as const;

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const SETTING_RULE_OPTIONS = [
    {
        tables: '[tools.eslint.rules]\ncomplexity = [40]\n',
        path: 'tools.eslint.rules.complexity',
        rule: 'complexity',
        setting: 'limits.cyclomatic_complexity',
    },
    {
        tables: '[[tools.eslint.override]]\npaths = ["src/**"]\nrules = { max-lines = [{ max = 900 }] }\n',
        path: 'tools.eslint.override.0.rules.max-lines',
        rule: 'max-lines',
        setting: 'limits.file_lines',
    },
    {
        tables: '[tools.markdownlint.rules]\nMD007 = { indent = 8 }\n',
        path: 'tools.markdownlint.rules.MD007',
        rule: 'MD007',
        setting: 'format.indent_width',
    },
    {
        tables: '[[scope]]\npath = "app"\n[scope.tools.eslint.rules]\n"sonarjs/no-identical-functions" = [50]\n',
        path: 'scope.0.tools.eslint.rules.sonarjs/no-identical-functions',
        rule: 'sonarjs/no-identical-functions',
        setting: 'duplication.min_lines',
    },
] as const;

export const REMOVED_TABLE_TOOLS = [
    'eslint',
    'knip',
    'prettier',
    'editorconfig-checker',
    'shellcheck',
    'taplo',
    'typos',
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

export const CAN_IMPORT_RULES = `[[import_rule]]
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
