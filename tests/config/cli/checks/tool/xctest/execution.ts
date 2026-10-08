export const XCTEST_EXECUTION_POLICY = `configurations = ["xctest", "xcode"]
[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
[coverage]
overrides = [{ target = "Example", percent = 80 }]
`;

export const SHEBANG = `#!${process.execPath}\n`;

export const XCTEST_FAILURES = [
    {
        failure: 'no-project',
        note: undefined,
        policy: 'configurations = ["xctest", "xcode"]\n[swift]\nxcode_project = ""\nxcode_scheme = "Example"\n[coverage]\noverrides = [{ target = "Example", percent = 80 }]\n',
        build: '',
        coverage: 1,
        code: 0,
        status: 'skipped',
        produced: false,
    },
    {
        failure: 'failed-test',
        note: 'test run exited 65',
        policy: XCTEST_EXECUTION_POLICY,
        build: 'process.exitCode = 65;',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'malformed',
        note: 'targets',
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-floor',
        note: undefined,
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: 0.5,
        code: 1,
        status: 'failed',
        produced: true,
    },
] as const;
