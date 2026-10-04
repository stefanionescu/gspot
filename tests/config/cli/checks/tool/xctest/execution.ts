export const XCTEST_EXECUTION_POLICY = `configurations = ["xctest", "xcode"]
[tools.xcode]
project = "Example.xcodeproj"
scheme = "Example"
[tools.xctest]
coverage = [{ target = "Example", percent = 80 }]
`;

export const SHEBANG = `#!${process.execPath}\n`;

export const XCTEST_FAILURES = [
    {
        failure: 'no-project',
        policy: 'configurations = ["xctest", "xcode"]\n[tools.xcode]\nproject = ""\nscheme = "Example"\n[tools.xctest]\ncoverage = [{ target = "Example", percent = 80 }]\n',
        build: '',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'failed-test',
        policy: XCTEST_EXECUTION_POLICY,
        build: 'process.exitCode = 65;',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'malformed',
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-floor',
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: 0.5,
        code: 1,
        status: 'failed',
        produced: true,
    },
] as const;
