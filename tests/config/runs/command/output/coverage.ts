export const FILELESS_COVERAGE_CASES = [
    {
        check: 'vitest/coverage',
        code: 1,
        output: 'ERROR: Coverage for lines (50%) does not meet global threshold (80%)',
        message: 'Coverage for lines (50%) does not meet global threshold (80%)',
    },
    {
        check: 'pytest/coverage',
        code: 1,
        output: 'FAIL Required test coverage of 80% not reached. Total coverage: 50%',
        message: 'FAIL Required test coverage of 80% not reached. Total coverage: 50%',
    },
    { check: 'pytest/coverage', code: 5, output: 'no tests ran in 0.01s', message: 'no tests ran in 0.01s' },
    { check: 'jest/coverage', code: 1, output: '  ● Test suite failed to run', message: '● Test suite failed to run' },
] as const;
