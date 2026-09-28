// Jest run over a disposable copy of the sources, with failed tests and coverage under its floors as findings.
import { z } from 'zod';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { sep, join, relative, isAbsolute } from 'node:path';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';
import type { Suite, JestRun, TestReport } from '#cli/types/checks/jest.ts';
import { jestPercentage, jestCoverageSettings } from '#cli/checks/jest/schema.ts';

const dimensions = ['lines', 'branches', 'functions', 'statements'] as const;
const metric = z.object({ pct: jestPercentage });
const coverageSchema = z.object({
    total: z.object({ lines: metric, branches: metric, functions: metric, statements: metric }),
});

// Read the Jest report and refuse a run that cannot execute its suites.
function readTestReport(reports: ConfinedRoot, stderr: string): TestReport {
    const testFile = reports.read('tests.json');
    if (testFile === undefined)
        throw new Error(`Jest produced no test report: ${stripVTControlCharacters(stderr).trim()}`);
    const tested = reportSchema.parse(JSON.parse(testFile.bytes.toString('utf8')));
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
    if (isAbsolute(file) || file === '..' || file.startsWith(`..${sep}`))
        throw new Error('Jest reported a test outside the selected source copy.');
    return file.split(sep).join('/');
}

// One finding per coverage dimension under its floor.
function coverageFindings(
    run: JestRun,
    reports: ConfinedRoot,
    settings: z.infer<typeof jestCoverageSettings>,
): Finding[] {
    const coverageFile = reports.read('coverage/coverage-summary.json');
    if (coverageFile === undefined)
        throw new Error('Jest produced no coverage summary. Enable coverage for the selected project.');
    const covered = coverageSchema.parse(JSON.parse(coverageFile.bytes.toString('utf8'))).total;
    return dimensions.flatMap((name) => {
        const floor = settings[`coverage_${name}`];
        if (covered[name].pct >= floor) return [];
        return [
            {
                check: run.input.spec.name,
                file: '',
                line: 1,
                rule: `coverage-${name}`,
                message: `Jest covers ${String(covered[name].pct)}% of ${name}, below the ${String(floor)}% floor.`,
                fixable: false,
            },
        ];
    });
}

// Runs Jest over the copied sources and reads its reports into findings.
async function runJest(
    run: JestRun,
    reports: ConfinedRoot,
    settings: z.infer<typeof jestCoverageSettings>,
): Promise<Finding[]> {
    const { input, source, work } = run;
    const thresholds = Object.fromEntries(dimensions.map((name) => [name, settings[`coverage_${name}`]]));
    const command = [
        'jest',
        '--coverage',
        '--runInBand',
        '--ci',
        '--json',
        '--testLocationInResults',
        '--outputFile',
        join(work, 'tests.json'),
        '--coverageDirectory',
        join(work, 'coverage'),
        '--coverageReporters=json-summary',
        `--coverageThreshold=${JSON.stringify({ global: thresholds })}`,
    ];
    const result = await runCheckCommand(input, command, { cwd: join(source, input.scope) });
    if (result.code !== 0 && result.code !== 1)
        throw new Error(
            `Jest could not run (exit ${String(result.code)}): ${stripVTControlCharacters(result.stderr).trim()}`,
        );
    const tested = readTestReport(reports, result.stderr);
    const findings = [
        ...tested.testResults.flatMap((suite) => {
            const file = suitePath(run.source, suite);
            return suite.assertionResults
                .filter((assertion) => assertion.status === 'failed')
                .map((assertion) => ({
                    check: run.input.spec.name,
                    file,
                    line: assertion.location?.line ?? 1,
                    ...(assertion.location === undefined || assertion.location === null
                        ? {}
                        : { column: assertion.location.column + 1 }),
                    rule: 'test-failure',
                    message: stripVTControlCharacters(assertion.failureMessages.join('\n')) || assertion.fullName,
                    fixable: false,
                }));
        }),
        ...coverageFindings(run, reports, settings),
    ];
    if ((result.code !== 0 || !tested.success) && findings.length === 0)
        throw new Error(
            `Jest failed without a test or coverage diagnostic: ${stripVTControlCharacters(result.stderr).trim()}`,
        );
    return findings;
}

export const reportSchema = z.object({
    success: z.boolean(),
    numTotalTests: z.number().int().nonnegative(),
    numRuntimeErrorTestSuites: z.number().int().nonnegative(),
    testResults: z.array(
        z.object({
            name: z.string().min(1),
            assertionResults: z.array(
                z.object({
                    fullName: z.string(),
                    status: z.enum(['passed', 'failed', 'skipped', 'pending', 'todo', 'disabled', 'focused']),
                    failureMessages: z.array(z.string()),
                    location: z
                        .object({ line: z.number().int().positive(), column: z.number().int().nonnegative() })
                        .nullable()
                        .optional(),
                }),
            ),
        }),
    ),
});

/**
 * Run repository-owned Jest against disposable sources and retain test and coverage failures as findings.
 * @param input the engine input
 * @returns the findings
 */
export async function jestCoverage(input: EngineInput): Promise<Finding[]> {
    const settings = jestCoverageSettings.parse(input.view.tool('jest'));
    const work = mkdtempSync(join(tmpdir(), 'gspot-jest-'));
    let source: string | undefined;
    const reports = openConfinedRoot(work);
    try {
        source = await scratchCopy(
            input.root,
            input.files.map((file) => file.path),
            input.scopeEntries.map((scope) => scope.path),
        );
        return await runJest({ input, source, work }, reports, settings);
    } finally {
        reports.close();
        if (source !== undefined) await rm(source, { recursive: true, force: true });
        await rm(work, { recursive: true, force: true });
    }
}
