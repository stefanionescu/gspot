export const VERSION_OUTPUTS = [
    {
        name: 'a version with an undeclared exit code',
        toolArguments: ['--line', '3.8.1', '--exit', '7'],
        state: 'error',
        found: undefined,
        note: 'The version command of version-teller exited 7: 3.8.1',
    },
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
        state: 'ok',
        found: '3.8.1',
        note: undefined,
    },
    {
        name: 'a version between color codes',
        toolArguments: ['--line', 'version-teller \u001B[1;36m3.8.1\u001B[0m using more'],
        state: 'ok',
        found: '3.8.1',
        note: undefined,
    },
] as const;
