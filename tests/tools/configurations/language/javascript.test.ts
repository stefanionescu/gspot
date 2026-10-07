// Source CLI journey: the javascript configuration lints a repository with no TypeScript.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { prepareTestRepository } from '#tests/harness/repository.ts';
import { REPOSITORY, CLEAN_MODULE } from '#tests/config/tools/configurations/language/javascript.ts';

test(
    'javascript/eslint lints a project that has no TypeScript',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareTestRepository(sandbox.path, REPOSITORY);
        const outcome = await runCheckCase(
            sandbox.path,
            {
                check: 'javascript/eslint',
                files: { 'src/paused.js': CLEAN_MODULE.replace('    return', () => '    debugger;\n    return') },
            },
            environment,
        );
        expect(outcome.code, outcome.stdout).toBe(1);
        const failed = JSON.parse(outcome.stdout) as RunReport;
        expect(failed.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            containing({ rule: 'no-debugger', file: 'src/paused.js', line: 9 }),
        );
        await Bun.write(
            join(sandbox.path, 'src/paused.js'),
            '// The number of orders.\n\n/** The number of orders. */\nexport const orderCount = 1;\n',
        );
        const corrected = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'javascript/eslint', '--json', '--', 'src/paused.js'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'passed', fileCount: 1, findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
