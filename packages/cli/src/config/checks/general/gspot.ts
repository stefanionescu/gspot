const APPLY_HELP =
    'Change settings in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';

export const GENERATED_FILE_MESSAGES = {
    changed: 'This generated file differs from what gspot.toml emits.',
    missing: 'This generated file is missing.',
    stray: 'gspot wrote this file, and no selected configuration writes it now.',
    conflict: 'This generated file holds merge conflict markers, so no tool can read it.',
} as const;

export const GENERATED_FILE_HELP = {
    changed: APPLY_HELP,
    missing: APPLY_HELP,
    stray: 'Delete the file, or add the configuration that emits it.',
    conflict: 'Run gspot apply to write the file again, then gspot install to install what it records.',
} as const;

export const NEGATED_PATTERN = /^!/u;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;
