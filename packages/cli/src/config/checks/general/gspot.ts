const APPLY_HELP = 'Run gspot apply.';

export const GENERATED_FILE_FINDINGS = {
    changed: { message: 'This generated file is out of date.', help: APPLY_HELP },
    missing: { message: 'This generated file is missing.', help: APPLY_HELP },
    stray: {
        message: 'gspot wrote this file, and no selected configuration writes it now.',
        help: 'Run gspot apply to delete it.',
    },
} as const;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

export const NEGATED_PATTERN = /^!/u;

export const UNESCAPED_BRACKET = /(?<!\\)[()[\]]/u;

export const BRACKET_HELP = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;

export const RULES = {
    unmatchedPath: 'unmatched-path',
    conflictingConfigFile: 'conflicting-config-file',
} as const;
