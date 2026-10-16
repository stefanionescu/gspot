const APPLY_HELP =
    'Change settings in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';

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
