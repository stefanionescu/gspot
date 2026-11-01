export const PACKAGE_METADATA_FAILURES = [
    { field: 'version', packageJson: { name: 'teller', version: false } },
] as const;

export const SYSTEM_PLUGIN_REPORTS = [
    {
        name: 'installed',
        stdout: 'registered third-party plugins:\n  pytest-cov-7.1.0 at /project/.venv/pytest_cov/plugin.py',
        code: 0,
        missing: false,
        inspection: { state: 'system', found: '7.1.0', minimumVersion: undefined },
    },
    {
        name: 'absent',
        stdout: 'pytest 9.1.1',
        code: 0,
        missing: false,
        inspection: { state: 'missing', note: 'The version command of the host tool does not list pytest-cov.' },
    },
] as const;
