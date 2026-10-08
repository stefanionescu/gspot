/** Native severities are not another way to select lint coverage. */
export const ESLINT_REJECTED_SELECTIONS = [
    '"error"',
    '"warn"',
    '0',
    '"off"',
    '["error"]',
    '["off", "always"]',
    '["warn", "always"]',
    '["error", {}]',
];

/** Markdown rule tables hold native options. Coverage comes from the selected level. */
export const MARKDOWNLINT_REJECTED_SELECTIONS = [
    'MD041 = true',
    'MD045 = false',
    'MD025 = 1',
    'MD001 = "error"',
    'MD024 = [true, {}]',
    'default = {}',
    '"heading-increment" = {}',
];

/** Python writers reject these native tables. */
export const UNSUPPORTED_PYTHON_OPTIONS = [
    {
        tool: 'ruff',
        options: 'preview = true',
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.ruff]',
    },
    {
        tool: 'ruff',
        options: 'lint.preview = true',
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.ruff]',
    },
    {
        tool: 'ruff',
        options: 'format.preview = true',
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.ruff]',
    },
    {
        tool: 'ruff',
        options: 'select = ["N802"]',
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.ruff]',
    },
    {
        tool: 'ruff',
        options: 'extend-select = ["N802"]',
        diagnostic: '`verbatim` is not a setting gspot knows under [tools.ruff]',
    },
    {
        tool: 'basedpyright',
        options: 'enableExperimentalFeatures = false',
        diagnostic: '`basedpyright` is not a setting gspot knows under [tools]',
    },
    {
        tool: 'basedpyright',
        options: 'enableExperimentalFeatures = true',
        diagnostic: '`basedpyright` is not a setting gspot knows under [tools]',
    },
];
