import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { rejection } from '#tests/harness/expectations.ts';

async function writeJestReports(
    root: string,
    output: string,
    coverageDirectory: string,
    scenario: {
        tests: 'valid' | 'malformed' | 'missing';
        testCount: number;
        runtimeFailures: number;
        status: string;
        coverage: number | string | undefined;
    },
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

const VALID = {
    tests: 'valid' as const,
    testCount: 1,
    runtimeFailures: 0,
    status: 'passed',
    coverage: 100,
    isOutside: false,
    code: 0,
    isTimedOut: false,
    isCanceled: false,
};

test.each([
    { failure: 'missing tests', changes: { tests: 'missing' as const } },
    { failure: 'malformed tests', changes: { tests: 'malformed' as const } },
    { failure: 'inconsistent test count', changes: { testCount: 2 } },
    { failure: 'no tests', changes: { testCount: 0 } },
    { failure: 'runtime failure', changes: { runtimeFailures: 1 } },
    { failure: 'missing coverage', changes: { coverage: undefined } },
    { failure: 'malformed coverage', changes: { coverage: 'Unknown' } },
    { failure: 'unknown status', changes: { status: 'unknown' } },
    { failure: 'outside test', changes: { isOutside: true } },
    { failure: 'unexpected exit', changes: { code: 2 } },
    { failure: 'deadline', changes: { isTimedOut: true } },
    { failure: 'cancellation', changes: { isCanceled: true } },
])('Jest adapter refuses $failure, cleans isolated artifacts, and accepts a corrected report', async ({ changes }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['jest']),
        'sample.js': 'const authored = true;\n',
        'node_modules/.bin/jest': '#!/usr/bin/env node\n',
    });
    const session = await openSession(sandbox.path);
    const spec = session.manifests.get('jest')!.checks[0]!;
    const input = scopeInput(session, spec);
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
        await rejection(jestCoverage(input));
        expect(artifacts).toHaveLength(2);
        expect(artifacts.every((path) => !existsSync(path))).toBe(true);
        expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
        isBroken = false;
        expect(await jestCoverage(input)).toStrictEqual([]);
        expect(artifacts).toHaveLength(4);
        expect(artifacts.every((path) => !existsSync(path))).toBe(true);
        expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
    } finally {
        process.mockRestore();
    }
});
