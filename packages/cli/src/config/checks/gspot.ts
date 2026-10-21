import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/repository/tracked.ts';

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

export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

/** Leave installed dependencies out of generator output snapshots. */
export const GENERATOR_IGNORED_FOLDERS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;

export const UNESCAPED_GROUP = /(?<!\\)[()[\]]/u;
export const GROUP_HINT = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;

export const EXPIRED_IGNORE_HELP =
    'Fix the findings and delete the ignore with gspot unignore. To keep it, write a later until date in gspot.toml.';
