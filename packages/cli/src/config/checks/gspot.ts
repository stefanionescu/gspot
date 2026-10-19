import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';

const APPLY_HELP =
    'Change settings in gspot.toml, then run gspot apply. gspot replaces the generated files that it owns.';

export const GENERATED_FILE_MESSAGES = {
    changed: 'This generated file differs from what gspot.toml generates.',
    missing: 'This generated file is missing.',
    stray: 'gspot wrote this file, and no selected configuration writes it now.',
} as const;

export const GENERATED_FILE_HELP = {
    changed: APPLY_HELP,
    missing: APPLY_HELP,
    stray: 'Delete the file, or add the configuration that generates it.',
} as const;

export const NEGATED_PATTERN = /^!/u;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const SUPPRESSION_DIRECTIVE_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

export const SUPPRESSION_LIMITS = new Map([
    [
        'eslint',
        {
            separator: /\s--/u,
            directive: /\beslint-disable(?:-next-line|-line)?\b(?<rules>[\s\S]*)/u,
            allRules: /^$/u,
            lintRules:
                /(?:^|[\s,])(?:complexity|sonarjs\/cognitive-complexity|max-lines|max-lines-per-function|max-statements|max-params|max-depth|max-nested-callbacks)(?=$|[\s,])/u,
        },
    ],
    [
        'ruff',
        {
            separator: /#/u,
            directive: /#\s*(?:(?:ruff|flake8):\s*)?[nN][oO][qQ][aA](?::(?<rules>[^#]*))?/u,
            allRules: /^$/u,
            lintRules: /(?:^|[\s,])(?:C901|PLR0911|PLR0912|PLR0913|PLR0915)(?=$|[\s,])/u,
        },
    ],
    [
        'swiftlint',
        {
            separator: /\s-\s/u,
            directive: /\bswiftlint:disable(?::(?:next|this|previous))?(?<rules>.*)/u,
            allRules: /^all(?=$|\s)/u,
            lintRules:
                /(?:^|[\s,])(?:cyclomatic_complexity|function_body_length|file_length|type_body_length|function_parameter_count)(?=$|[\s,])/u,
        },
    ],
]);

/** Leave installed dependencies out of generator output snapshots. */
export const GENERATOR_SCAN_EXCLUSIONS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;

/** A parenthesis or bracket without a backslash, which a glob reads as syntax rather than a folder name. */
export const UNESCAPED_GROUP = /(?<!\\)[()[\]]/u;
export const GROUP_HINT = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;
