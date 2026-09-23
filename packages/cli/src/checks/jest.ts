import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { z } from 'zod';
import { jestCoverageSettings, jestPercentage } from '#cli/checks/jest-settings.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { scratchCopy } from '#cli/run/fixers.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';

const dimensions = ['lines', 'branches', 'functions', 'statements'] as const;
const reportSchema = z.object({
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
const metric = z.object({ pct: jestPercentage });
const coverageSchema = z.object({
    total: z.object({ lines: metric, branches: metric, functions: metric, statements: metric }),
});

/** Run repository-owned Jest against disposable sources and retain test and coverage failures as findings. */
export async function jestCoverage(input: EngineInput): Promise<Finding[]> {
    const settings = jestCoverageSettings.parse(input.view.tool('jest'));
    const thresholds = Object.fromEntries(dimensions.map((name) => [name, settings[`coverage_${name}`]]));
    const work = mkdtempSync(join(tmpdir(), 'gspot-jest-'));
    let source: string | undefined;
    const reports = openConfinedRoot(work);
    try {
        source = scratchCopy(
            input.root,
            input.files.map((file) => file.path),
            input.scopeEntries.map((scope) => scope.path),
        );
        const result = await runCheckCommand(
            input,
            [
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
            ],
            { cwd: join(source, input.scope) },
        );
        if (result.code !== 0 && result.code !== 1)
            throw new Error(
                `Jest could not run (exit ${String(result.code)}): ${stripVTControlCharacters(result.stderr).trim()}`,
            );
        const testFile = reports.read('tests.json');
        if (testFile === undefined)
            throw new Error(`Jest produced no test report: ${stripVTControlCharacters(result.stderr).trim()}`);
        const tested = reportSchema.parse(JSON.parse(testFile.bytes.toString('utf8')));
        if (tested.numRuntimeErrorTestSuites > 0)
            throw new Error('Jest could not load or execute a test suite. Correct its configuration and imports.');
        if (tested.numTotalTests === 0)
            throw new Error('Jest executed no tests. Check the selected project and test patterns.');
        const assertions = tested.testResults.reduce((count, suite) => count + suite.assertionResults.length, 0);
        if (assertions !== tested.numTotalTests) throw new Error('Jest reported an inconsistent test count.');
        const findings: Finding[] = [];
        for (const suite of tested.testResults) {
            const file = relative(source, suite.name);
            if (isAbsolute(file) || file === '..' || file.startsWith(`..${sep}`))
                throw new Error('Jest reported a test outside the selected source copy.');
            for (const assertion of suite.assertionResults) {
                if (assertion.status !== 'failed') continue;
                findings.push({
                    check: input.spec.name,
                    file: file.split(sep).join('/'),
                    line: assertion.location?.line ?? 1,
                    ...(assertion.location === undefined || assertion.location === null
                        ? {}
                        : { column: assertion.location.column + 1 }),
                    rule: 'test-failure',
                    message: stripVTControlCharacters(assertion.failureMessages.join('\n')) || assertion.fullName,
                    fixable: false,
                });
            }
        }
        const coverageFile = reports.read('coverage/coverage-summary.json');
        if (coverageFile === undefined)
            throw new Error('Jest produced no coverage summary. Enable coverage for the selected project.');
        const covered = coverageSchema.parse(JSON.parse(coverageFile.bytes.toString('utf8'))).total;
        for (const name of dimensions) {
            const floor = settings[`coverage_${name}`];
            if (covered[name].pct >= floor) continue;
            findings.push({
                check: input.spec.name,
                file: '',
                line: 1,
                rule: `coverage-${name}`,
                message: `Jest covers ${String(covered[name].pct)}% of ${name}, below the ${String(floor)}% floor.`,
                fixable: false,
            });
        }
        if ((result.code !== 0 || !tested.success) && findings.length === 0)
            throw new Error(
                `Jest failed without a test or coverage diagnostic: ${stripVTControlCharacters(result.stderr).trim()}`,
            );
        return findings;
    } finally {
        reports.close();
        if (source !== undefined) rmSync(source, { recursive: true, force: true });
        rmSync(work, { recursive: true, force: true });
    }
}
