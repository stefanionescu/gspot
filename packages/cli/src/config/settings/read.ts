import type { Check } from '#cli/types/manifests.ts';

export const COMMAND_CHECK_DEFAULTS = {
    level: 'basic',
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

export const COMMAND_CHECK_WHY = 'This repository runs this command as one of its checks.';

export const COMMAND_CHECK_HELP = 'Read the command output; this repository declares the check.';
