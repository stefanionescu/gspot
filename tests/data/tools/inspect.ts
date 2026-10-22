/** Installed package metadata with a name or version that holds no string. */
export const PACKAGE_METADATA_FAILURES = [
    { field: 'name', packageJson: { name: false, version: '5.0.1' } },
    { field: 'version', packageJson: { name: 'teller', version: false } },
] as const;

export const SYSTEM_PLUGIN_REPORTS = [
    {
        name: 'installed',
        stdout: 'registered third-party plugins:\n  pytest-cov-7.1.0 at /project/.venv/pytest_cov/plugin.py',
        code: 0,
        missing: false,
        state: 'system',
        found: '7.1.0',
    },
    {
        name: 'absent',
        stdout: 'pytest 9.1.1',
        code: 0,
        missing: false,
        state: 'missing',
        note: 'pytest-cov is not reported',
    },
    {
        name: 'invalid',
        stdout: 'pytest-cov-invalid',
        pattern: 'pytest-cov-(invalid)',
        code: 0,
        missing: false,
        state: 'error',
        note: 'valid version',
    },
    { name: 'failed', stdout: '', code: 7, missing: false, state: 'error', note: 'exited 7' },
    { name: 'missing', stdout: '', code: 0, missing: true, state: 'missing' },
] as const;
