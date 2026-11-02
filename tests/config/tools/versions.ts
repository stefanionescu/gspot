export const TOOL_PROJECT_PACKAGES = [
    {
        name: 'npm',
        tool: 'linter',
        version: '1.0.0',
        system: false,
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        expected: { kind: 'npm', name: 'linter', version: '1.0.0', requires: ['node'] },
    },
    {
        name: 'npm with a mise installer',
        tool: 'searcher',
        version: '2.0.0',
        system: false,
        installers: {
            npm: { name: '@scope/searcher', version: '2.0.0' },
            mise: { name: 'searcher', version: '2.0.0', checksums: {} },
        },
        expected: { kind: 'npm', name: '@scope/searcher', version: '2.0.0', requires: ['node'] },
    },
    {
        name: 'Python',
        tool: 'formatter',
        version: '3.0.0',
        system: false,
        installers: {
            pypi: { name: 'formatter', version: '3.0.0' },
            mise: { name: 'formatter', version: '3.0.0', checksums: {} },
        },
        expected: { kind: 'python', name: 'formatter', version: '3.0.0' },
    },
    {
        name: 'a system tool with a pypi pin',
        tool: 'checker',
        version: '5.0.0',
        system: true,
        installers: { pypi: { name: 'checker', version: '5.0.0' } },
        expected: undefined,
    },
    {
        name: 'no installer',
        tool: 'compiler',
        version: '4.0.0',
        system: false,
        installers: {},
        expected: undefined,
    },
] as const;

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

export const VERSION_OUTPUTS = [
    {
        name: 'text without a version',
        toolArguments: ['--line', 'unrecognized output'],
        state: 'error',
        found: undefined,
        note: 'version-teller did not report a valid version: unrecognized output',
    },
    {
        name: 'a version on stderr',
        toolArguments: ['--stderr', '3.8.1\n'],
        state: 'system',
        found: '3.8.1',
        note: undefined,
    },
    {
        name: 'a version between color codes',
        toolArguments: ['--line', 'version-teller \u{1B}[1;36m3.8.1\u{1B}[0m using more'],
        state: 'system',
        found: '3.8.1',
        note: undefined,
    },
] as const;

export const SYSTEM_BASH_VERSIONS = [
    ['3.2.57', 'outdated'],
    ['5.2.0', 'system'],
] as const;
