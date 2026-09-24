import { dirname, join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, readFileSync } from 'node:fs';
import * as processes from '#cli/platform/spawn.ts';
import { jestCoverage } from '#cli/checks/jest/run.ts';

const failures = [
    'missing tests',
    'malformed tests',
    'inconsistent test count',
    'no tests',
    'runtime failure',
    'missing coverage',
    'malformed coverage',
    'unknown status',
    'outside test',
    'unexpected exit',
    'deadline',
    'cancellation',
];

test.each(failures)('Jest refuses %s, cleans isolated artifacts, and accepts a corrected report', async (failure) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["jest"]\n',
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
    let broken = true;
    const artifacts: string[] = [];
    const process = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
        const source = options.cwd;
        const output = argv[argv.indexOf('--outputFile') + 1]!;
        const coverage = argv[argv.indexOf('--coverageDirectory') + 1]!;
        artifacts.push(source, dirname(output));
        await Bun.write(join(source, 'sample.js'), 'temporary test output');
        if (!(broken && failure === 'missing tests')) {
            await Bun.write(
                output,
                broken && failure === 'malformed tests'
                    ? '{}'
                    : JSON.stringify({
                          success: true,
                          numTotalTests: broken ? ({ 'inconsistent test count': 2, 'no tests': 0 }[failure] ?? 1) : 1,
                          numRuntimeErrorTestSuites: broken && failure === 'runtime failure' ? 1 : 0,
                          testResults: [
                              {
                                  name: join(broken && failure === 'outside test' ? sandbox.path : source, 'sample.js'),
                                  assertionResults: [
                                      {
                                          fullName: 'checks the sample',
                                          status: broken && failure === 'unknown status' ? 'unknown' : 'passed',
                                          failureMessages: [],
                                      },
                                  ],
                              },
                          ],
                      }),
            );
        }
        if (!(broken && failure === 'missing coverage'))
            await Bun.write(
                join(coverage, 'coverage-summary.json'),
                JSON.stringify({
                    total: Object.fromEntries(
                        ['lines', 'branches', 'functions', 'statements'].map((name) => [
                            name,
                            { pct: broken && failure === 'malformed coverage' ? 'Unknown' : 100 },
                        ]),
                    ),
                }),
            );
        return {
            code: broken && failure === 'unexpected exit' ? 2 : 0,
            missing: false,
            stdout: '',
            stderr: '',
            duration: 1,
            ...(broken && failure === 'deadline' ? { isTimedOut: true } : {}),
            ...(broken && failure === 'cancellation' ? { isCanceled: true } : {}),
        };
    });
    try {
        await expect(jestCoverage(input)).rejects.toThrow();
        expect(artifacts.every((path) => !existsSync(path))).toBe(true);
        expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
        broken = false;
        expect(await jestCoverage(input)).toStrictEqual([]);
        expect(artifacts.every((path) => !existsSync(path))).toBe(true);
        expect(readFileSync(join(sandbox.path, 'sample.js'), 'utf8')).toBe('const authored = true;\n');
    } finally {
        process.mockRestore();
    }
});
