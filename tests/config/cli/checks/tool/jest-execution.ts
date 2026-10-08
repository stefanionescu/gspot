export const OUTCOMES = [
    {
        name: 'native threshold',
        code: 1,
        stderr: 'Jest: "global" coverage threshold for functions (80%) not met: 50%\n',
        status: 'failed' as const,
        note: undefined,
        isTimedOut: false,
        isCanceled: false,
    },
    {
        name: 'failed test',
        code: 1,
        stderr: 'FAIL ./sample.test.cjs\n  ● checks the sample\n    Expected: 2\n    Received: 1\n',
        status: 'failed' as const,
        note: undefined,
        isTimedOut: false,
        isCanceled: false,
    },
    {
        name: 'unexpected exit',
        code: 2,
        stderr: '',
        status: 'error' as const,
        note: 'exit 2',
        isTimedOut: false,
        isCanceled: false,
    },
    {
        name: 'deadline',
        code: 1,
        stderr: '',
        status: 'error' as const,
        note: 'ran past',
        isTimedOut: true,
        isCanceled: false,
    },
    {
        name: 'cancellation',
        code: 1,
        stderr: '',
        status: 'error' as const,
        note: 'canceled',
        isTimedOut: false,
        isCanceled: true,
    },
];

export const SAMPLE = 'const authored = true;\n';

export const ZERO_COMMANDS = {
    jest: ['jest', '--ci', '--rootDir={root}/{scope}'],
    pytest: ['pytest', '-q', '--strict-markers', '--strict-config', '--no-header', '-p', 'no:cacheprovider'],
    vitest: ['vitest', 'run'],
};
