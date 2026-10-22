/** A failed npm version lookup. */
export const FAILED_NPM_VERSION = {
    code: 7,
    missing: false,
    duration: 0,
    stdout: '',
    stderr: 'version lookup failed',
} as const;
