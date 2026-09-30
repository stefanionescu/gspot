// Writes native Jest artifacts for adapter failure and recovery scenarios.
import { join } from 'node:path';
import type { JestReportInputs } from '#tests/types/integration/cli/checks.ts';

/**
 * Writes the selected test and coverage reports without changing the source fixture.
 * @param root the directory reported as owning the test.
 * @param output the test report destination.
 * @param coverageDirectory the coverage artifact directory.
 * @param scenario the native report values or requested missing artifacts.
 */
export async function writeJestReports(
    root: string,
    output: string,
    coverageDirectory: string,
    scenario: JestReportInputs,
): Promise<void> {
    const report = {
        success: true,
        numTotalTests: scenario.testCount,
        numRuntimeErrorTestSuites: scenario.runtimeFailures,
        testResults: [
            {
                name: join(root, 'sample.js'),
                assertionResults: [{ fullName: 'checks the sample', status: scenario.status, failureMessages: [] }],
            },
        ],
    };
    if (scenario.tests !== 'missing')
        await Bun.write(output, scenario.tests === 'malformed' ? '{}' : JSON.stringify(report));
    if (scenario.coverage !== undefined) {
        const total = Object.fromEntries(
            ['lines', 'branches', 'functions', 'statements'].map((name) => [name, { pct: scenario.coverage }]),
        );
        await Bun.write(join(coverageDirectory, 'coverage-summary.json'), JSON.stringify({ total }));
    }
}
