/** Native disabled values must produce the matching accepted-finding command. */
export const DISABLED_RULES = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        rule: 'subject-case',
        value: [0, 'always', 'sentence-case'],
        check: 'commits/commitlint',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        rule: 'line-length',
        value: 'disable',
        check: 'files/yamllint',
    },
];

export const INVALID_ENVIRONMENT_SETTINGS = [
    { table: 'dotenv', value: 'accessor = "read_env"', diagnostic: 'dotenv' },
    { table: 'env', value: 'accessor = "read_env"', diagnostic: 'accessor' },
    { table: 'env', value: 'enabled = false', diagnostic: 'enabled' },
    { table: 'env', value: 'reader_functions = "read_env"', diagnostic: 'reader_functions' },
    { table: 'env', value: 'reader_functions = [false]', diagnostic: 'reader_functions' },
    { table: 'env', value: 'reader_functions = [""]', diagnostic: 'reader_functions' },
    { table: 'env', value: 'templates = [false]', diagnostic: 'templates' },
];

/** Framework coverage follows the level and declared dependencies, with no extra switches. */
export const REMOVED_FRAMEWORK_CONTROLS = [
    {
        table: 'tools.next',
        key: 'build_on_push',
        diagnostic: 'No selected configuration has the setting `tools.next.build_on_push`',
    },
    { table: 'nestjs', key: 'swagger', diagnostic: '`nestjs` is not a setting gspot knows' },
];

/** Native Stylelint options own at-rule exceptions. */
export const REMOVED_STYLELINT_SETTING = '[tools.stylelint]\nignore_at_rules = ["container"]\n';
