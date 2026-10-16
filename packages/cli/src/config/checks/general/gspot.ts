const APPLY_HELP =
    'Change settings in gspot.toml, then run gspot apply. gspot replaces the generated files that it owns.';

export const GENERATED_FILE_MESSAGES = {
    changed: 'This generated file differs from what gspot.toml emits.',
    missing: 'This generated file is missing.',
    stray: 'gspot wrote this file, and no selected configuration writes it now.',
} as const;

export const GENERATED_FILE_HELP = {
    changed: APPLY_HELP,
    missing: APPLY_HELP,
    stray: 'Delete the file, or add the configuration that emits it.',
} as const;

export const NEGATED_PATTERN = /^!/u;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const LIMIT_SUPPRESSION_MESSAGE =
    'Split the code by its steps, or ask the user to raise the limit in gspot.toml.';

export const SUPPRESSION_LIMITS = new Map([
    [
        'eslint',
        {
            separator: /\s--/u,
            directive: /\beslint-disable(?:-next-line|-line)?\b(?<rules>[\s\S]*)/u,
            lintRules:
                /(?:^|[\s,])(?:complexity|sonarjs\/cognitive-complexity|max-lines|max-lines-per-function|max-statements|max-params|max-depth|max-nested-callbacks)(?=$|[\s,])/u,
        },
    ],
    [
        'ruff',
        {
            separator: /#/u,
            directive: /#\s*(?:(?:ruff|flake8):\s*)?[nN][oO][qQ][aA](?::(?<rules>[^#]*))?/u,
            lintRules: /(?:^|[\s,])(?:C901|PLR0911|PLR0912|PLR0913|PLR0915)(?=$|[\s,])/u,
        },
    ],
    [
        'swiftlint',
        {
            separator: /\s-\s/u,
            directive: /\bswiftlint:disable(?::(?:next|this|previous))?(?<rules>.*)/u,
            lintRules:
                /(?:^|[\s,])(?:all|cyclomatic_complexity|function_body_length|file_length|type_body_length|function_parameter_count)(?=$|[\s,])/u,
        },
    ],
]);
