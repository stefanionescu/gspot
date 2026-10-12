// svelte-check writes each diagnostic on a line of its own: a timestamp, then the diagnostic as JSON.
export const DIAGNOSTIC_LINE = /^\d+ (?<diagnostic>\{.*\})$/u;

export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;

export const SVELTE_DIAGNOSTIC_TYPES = ['ERROR', 'WARNING'] as const;

export const SVELTE_CHECK_COMMAND = [
    'svelte-check',
    '--workspace',
    '.',
    '--output',
    'machine-verbose',
    '--fail-on-warnings',
] as const;

export const SVELTE_TSCONFIG_FLAG = '--tsconfig';
