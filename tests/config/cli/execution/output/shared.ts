import type { CheckSpec } from '#cli/types/configurations.ts';

export const BASE_CHECK = {
    name: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'recommended',
    stage: 'commit',
    runs: 'files',
    summary: '',
    why: '',
    help: '',
} satisfies CheckSpec;
export const EMPTY_FAILURE = { code: 1, stdout: '', stderr: '', missing: false, duration: 1 };
