import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { writeJestReports } from '#tests/support/cli/jest.ts';

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
    const input = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
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
