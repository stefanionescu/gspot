/** The fixture contract owned by this behavior's tests. */
export type JestScenario = {
    tests: 'valid' | 'malformed' | 'missing';
    testCount: number;
    runtimeFailures: number;
    status: string;
    coverage: number | string | undefined;
};
