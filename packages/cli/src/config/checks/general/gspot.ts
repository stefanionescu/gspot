const APPLY_HELP = 'Run gspot apply to write it again; to change what it holds, change gspot.toml.';

export const GENERATED_FILE_FINDINGS = {
    changed: { message: 'This generated file differs from what gspot.toml generates.', help: APPLY_HELP },
    missing: { message: 'This generated file is missing.', help: APPLY_HELP },
    stray: {
        message: 'gspot wrote this file, and no selected configuration writes it now.',
        help: 'Delete the file, or add the configuration that generates it.',
    },
} as const;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

export const ISO_DATE_LENGTH = 10;

export const EXPIRED_IGNORE_HELP =
    'Fix the findings and delete the ignore with gspot unignore. To keep it, write a later until date in gspot.toml.';

export const NEGATED_PATTERN = /^!/u;

export const UNESCAPED_GROUP = /(?<!\\)[()[\]]/u;

export const GROUP_HELP = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;
