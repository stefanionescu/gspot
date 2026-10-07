import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { VALID } from '#tests/config/cli/checks/tool/jest-execution.ts';
import type { JestScenario } from '#tests/types/cli/checks/tool/jest.ts';

async function writeJestReports(
    root: string,
    output: string,
    coverageDirectory: string,
    scenario: JestScenario,
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

test.each([
    { failure: 'missing tests', diagnostic: 'Jest produced no test report', changes: { tests: 'missing' as const } },
    { failure: 'malformed tests', diagnostic: 'numTotalTests', changes: { tests: 'malformed' as const } },
    { failure: 'inconsistent test count', diagnostic: 'inconsistent test count', changes: { testCount: 2 } },
    { failure: 'no tests', diagnostic: 'Jest executed no tests', changes: { testCount: 0 } },
    { failure: 'runtime failure', diagnostic: 'could not load or execute', changes: { runtimeFailures: 1 } },
    { failure: 'missing coverage', diagnostic: 'Jest produced no coverage summary', changes: { coverage: undefined } },
    { failure: 'malformed coverage', diagnostic: 'pct', changes: { coverage: 'Unknown' } },
    { failure: 'unknown status', diagnostic: 'status', changes: { status: 'unknown' } },
    { failure: 'outside test', diagnostic: 'outside the selected source copy', changes: { isOutside: true } },
    { failure: 'unexpected exit', diagnostic: 'exit 2', changes: { code: 2 } },
    { failure: 'deadline', diagnostic: 'ran past', changes: { isTimedOut: true } },
    { failure: 'cancellation', diagnostic: 'canceled', changes: { isCanceled: true } },
])(
    'Jest adapter refuses $failure, cleans isolated artifacts, and accepts a corrected report',
    async ({ changes, diagnostic }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['jest']),
            'sample.js': 'const authored = true;\n',
            'node_modules/.bin/jest': '#!/usr/bin/env node\n',
        });
        const session = await openSession(sandbox.path);
        const spec = session.manifests.get('jest')!.checks[0]!;
        const input = buildEngineInput(session, spec.name);
        let isBroken = true;
        const artifacts: string[] = [];
        const process = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            const source = options.cwd;
            const output = argv[argv.indexOf('--outputFile') + 1]!;
            const coverage = argv[argv.indexOf('--coverageDirectory') + 1]!;
            artifacts.push(source, dirname(output));
            await Bun.write(join(source, 'sample.js'), 'temporary test output');
            const scenario = { ...VALID, ...(isBroken ? changes : {}) };
            await writeJestReports(scenario.isOutside ? sandbox.path : source, output, coverage, scenario);
            return {
                code: scenario.code,
                missing: false,
                stdout: '',
                stderr: '',
                duration: 1,
                isTimedOut: scenario.isTimedOut,
                isCanceled: scenario.isCanceled,
            };
        });
        try {
            expect(await rejection(jestCoverage(input))).toContain(diagnostic);
            expect(artifacts.length).toBeGreaterThan(0);
            expect(artifacts.every((path) => !existsSync(path))).toBe(true);
            expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
            isBroken = false;
            expect(await jestCoverage(input)).toStrictEqual([]);
            expect(artifacts.every((path) => !existsSync(path))).toBe(true);
            expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
        } finally {
            process.mockRestore();
        }
    },
);
