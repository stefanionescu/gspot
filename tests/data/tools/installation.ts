const NPM_TOOL_FOLDER = '.gspot/node_modules';

/** Whole logged installations share refusal, recovery, and pruning contracts. */
export const TOOL_FOLDERS = [
    { kind: 'npm', folder: NPM_TOOL_FOLDER },
    { kind: 'vale', folder: '.gspot/vale' },
] as const;

export const REGISTRY_PASSWORDS = [
    ['https://example.com/simple', []],
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
    ['https://alex:password@example.com/simple', ['password', 'password']],
] as const;

export const LEAKED_LOCKFILES = [
    ['password = "synthetic/password+with spaces"'],
    ['url = "https://alex:synthetic%2Fpassword%2Bwith%20spaces@example.com/simple"'],
] as const;

/** Package identity and version fields require strings at the installed-file boundary. */
export const PACKAGE_METADATA_FAILURES = [
    { field: 'name', manifest: { name: false, version: '5.0.1' } },
    { field: 'version', manifest: { name: 'teller', version: false } },
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

/** Native version-process bytes and their inspection outcomes. */
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
] as const;
