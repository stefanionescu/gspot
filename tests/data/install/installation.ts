/** Tool folders installed as a whole, which refuse, recover, and prune the same way. */
export const TOOL_FOLDERS = [
    { kind: 'npm', folder: '.gspot/node_modules' },
    { kind: 'vale', folder: '.gspot/vale' },
] as const;

export const REGISTRY_PASSWORDS = [
    ['https://example.com/simple', []],
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
    ['https://alex:password@example.com/simple', ['password', 'password']],
] as const;

export const LEAKED_LOCKFILES = [
    'password = "synthetic/password+with spaces"',
    'url = "https://alex:synthetic%2Fpassword%2Bwith%20spaces@example.com/simple"',
] as const;

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

/** Version command output and the result of reading it. */
export const VERSION_OUTPUTS = [
    [
        'console.log("3.8.1"); process.exitCode = 7;',
        'error',
        undefined,
        'version-teller version inspection exited 7: 3.8.1',
    ],
    [
        'console.log("unrecognized output");',
        'error',
        undefined,
        'version-teller did not report a valid version: unrecognized output',
    ],
    ['console.error("3.8.1");', 'ok', '3.8.1', undefined],
    // The version keeps no color codes from around it.
    [String.raw`console.log("version-teller \u001b[1;36m3.8.1\u001b[0m using more");`, 'ok', '3.8.1', undefined],
] as const;
