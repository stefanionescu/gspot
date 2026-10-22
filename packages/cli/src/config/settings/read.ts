import type { Check } from '#cli/types/configurations.ts';

export const COMMAND_CHECK_DEFAULTS = {
    level: 'recommended',
    runs: 'files',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} satisfies Pick<Check, 'level' | 'runs'> & {
    files: Omit<NonNullable<Check['files']>, 'paths'>;
};
