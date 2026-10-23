export const PACKAGE_MANAGER_TIMEOUT = {
    code: 1,
    missing: false,
    duration: 0,
    stdout: '',
    stderr: '',
    timedOut: true,
} as const;

export const FAILED_INSTALL_CASES = [
    { operation: 'installation', frozen: true },
    { operation: 'lockfile resolution', frozen: false },
] as const;
