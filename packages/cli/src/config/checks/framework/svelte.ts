export const FINDING_LINE = /^\d+ (?<message>\{.*\})$/u;

export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;

export const SVELTE_CHECK_COMMAND = [
    'svelte-check',
    '--workspace',
    '.',
    '--output',
    'machine-verbose',
    '--fail-on-warnings',
] as const;

export const SVELTE_TSCONFIG_FLAG = '--tsconfig';

export const SVELTE_CHECK_RULE = 'svelte-check';
