/** An installed package.json whose name or version holds no string. */
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
        inspection: { state: 'system', found: '7.1.0' },
    },
    {
        name: 'absent',
        stdout: 'pytest 9.1.1',
        code: 0,
        missing: false,
        inspection: { state: 'missing', note: 'The version command of the host tool does not list pytest-cov.' },
    },
    {
        name: 'invalid',
        stdout: 'pytest-cov-invalid',
        pattern: 'pytest-cov-(invalid)',
        code: 0,
        missing: false,
        inspection: { state: 'error', note: 'pytest-cov did not report a valid version: pytest-cov-invalid' },
    },
    {
        name: 'failed',
        stdout: '',
        code: 7,
        missing: false,
        inspection: { state: 'error', note: 'The version command of pytest-cov exited 7: ' },
    },
    { name: 'missing', stdout: '', code: 0, missing: true, inspection: { state: 'missing', note: '' } },
] as const;
