const APPLY_HELP =
    'Change settings in gspot.toml, then run gspot apply. gspot replaces the generated files that it owns.';

export const GENERATED_FILE_FINDINGS = {
    changed: { message: 'This generated file differs from what gspot.toml generates.', help: APPLY_HELP },
    missing: { message: 'This generated file is missing.', help: APPLY_HELP },
    stray: {
        message: 'gspot wrote this file, and no selected configuration writes it now.',
        help: 'Delete the file, or add the configuration that generates it.',
    },
} as const;
