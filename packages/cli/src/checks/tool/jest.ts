// Jest run over a disposable copy of the sources, with failed tests and coverage under its floors as findings.
import { join, relative } from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { stripVTControlCharacters } from 'node:util';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { reportSchema, coverageSchema } from '#cli/parsers/schema/jest.ts';
import type { Suite, JestRun, TestReport, JestSettings } from '#cli/types/checks/tool/jest.ts';

import {
    TEST_REPORT,
    COVERAGE_SUMMARY,
    COVERAGE_DIRECTORY,
    COVERAGE_DIMENSIONS,
} from '#cli/config/checks/tool/jest.ts';

// Read the Jest report and refuse a run that cannot execute its suites.
function readReport(work: string, stderr: string): TestReport {
    const path = join(work, TEST_REPORT);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(`Jest produced no test report: ${stripVTControlCharacters(stderr).trim()}`);
    const tested = reportSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    if (tested.numRuntimeErrorTestSuites > 0)
        throw new Error('Jest could not load or execute a test suite. Correct its configuration and imports.');
    if (tested.numTotalTests === 0)
        throw new Error('Jest executed no tests. Check the selected project and test patterns.');
    const assertions = tested.testResults.reduce((count, suite) => count + suite.assertionResults.length, 0);
    if (assertions !== tested.numTotalTests) throw new Error('Jest reported an inconsistent test count.');
    return tested;
}

// The source-relative path of a test suite, which must lie inside the copied sources.
function suitePath(source: string, suite: Suite): string {
    const file = relative(source, suite.name);
    if (!isInside(file)) throw new Error('Jest reported a test outside the selected source copy.');
    return toPosix(file);
}

// One finding per coverage dimension under its floor.
function coverageFindings(run: JestRun, settings: JestSettings): Finding[] {
    const path = join(run.work, COVERAGE_SUMMARY);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error('Jest produced no coverage summary. Enable coverage for the selected project.');
    const covered = coverageSchema.parse(JSON.parse(readFileSync(path, 'utf8'))).total;
    return COVERAGE_DIMENSIONS.flatMap((name) => {
        const floor = settings[name];
        if (covered[name].pct >= floor) return [];
        return [
            findingAt(
                run.input,
                { file: '', line: 1 },
                `coverage-${name}`,
                `Jest covers ${String(covered[name].pct)}% of ${name}, below the ${String(floor)}% floor.`,
            ),
        ];
    });
}

// Runs Jest over the copied sources and reads its reports into findings.
async function runJest(run: JestRun, settings: JestSettings): Promise<Finding[]> {
    const { input, source, work } = run;
    const thresholds = Object.fromEntries(COVERAGE_DIMENSIONS.map((name) => [name, settings[name]]));
    const command = [
        'jest',
        '--coverage',
        '--runInBand',
        '--ci',
        '--json',
        '--testLocationInResults',
        '--outputFile',
        join(work, TEST_REPORT),
        '--coverageDirectory',
        join(work, COVERAGE_DIRECTORY),
        '--coverageReporters=json-summary',
        `--coverageThreshold=${JSON.stringify({ global: thresholds })}`,
    ];
    const result = await runCheckTool(input, command, { cwd: join(source, input.scope) });
    if (result.code !== 0 && result.code !== 1)
        throw new Error(
            `Jest could not run (exit ${String(result.code)}): ${stripVTControlCharacters(result.stderr).trim()}`,
        );
    const tested = readReport(work, result.stderr);
    const findings = [
        ...tested.testResults.flatMap((suite) => {
            const file = suitePath(run.source, suite);
            return suite.assertionResults
                .filter((assertion) => assertion.status === 'failed')
                .map((assertion) =>
                    findingAt(
                        run.input,
                        {
                            file,
                            line: assertion.location?.line ?? 1,
                            ...(assertion.location === undefined || assertion.location === null
                                ? {}
                                : { column: assertion.location.column + 1 }),
                        },
                        'test-failure',
                        stripVTControlCharacters(assertion.failureMessages.join('\n')) || assertion.fullName,
                    ),
                );
        }),
        ...coverageFindings(run, settings),
    ];
    if ((result.code !== 0 || !tested.success) && findings.length === 0)
        throw new Error(
            `Jest failed without a test or coverage diagnostic: ${stripVTControlCharacters(result.stderr).trim()}`,
        );
    return findings;
}

/**
 * Run repository-owned Jest against disposable sources and retain test and coverage failures as findings.
 * @param input the check input
 * @returns the findings
 */
export async function jestCoverage(input: CheckInput): Promise<Finding[]> {
    const settings = input.view.options('coverage');
    using work = scratchFolder('gspot-jest-');
    using source = await copyIntoScratch(input);
    return await runJest({ input, source: source.path, work: work.path }, settings);
}
