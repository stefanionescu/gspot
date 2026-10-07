import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { NON_ERROR_FAILURES } from '#tests/config/cli/execution/errors.ts';

test.each(NON_ERROR_FAILURES)(
    'a third-party engine throwing $thrown produces an actionable error',
    async ({ thrown, note }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: '[[check]]\nname = "project/source"\ncommand = ["bun", "-e", ""]\npaths = ["source.txt"]\nstage = "commit"\n',
            }),
            'source.txt': 'source',
        });
        const outcome = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({
                only: ['project/source'],
                checks: {
                    'project/source': {
                        run: runEngineCheck(() => {
                            // eslint-disable-next-line @typescript-eslint/only-throw-error -- reason: The test exercises third-party engines that throw non-Error values.
                            throw thrown;
                        }),
                    },
                },
            }),
        );
        expect(outcome.report.exitCode).toBe(2);
        expect(outcome.report.checks).toMatchObject([{ check: 'project/source', status: 'error', findings: [], note }]);
    },
);
