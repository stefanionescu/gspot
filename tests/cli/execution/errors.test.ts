import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { NON_ERROR_FAILURES } from '#tests/config/cli/execution/errors.ts';

test.each(NON_ERROR_FAILURES)(
    'a built-in check throwing $thrown produces an actionable error',
    async ({ thrown, note }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: '[check."project/source"]\ncommand = ["bun", "-e", ""]\npaths = ["source.txt"]\nstage = "commit"\n',
            }),
            'source.txt': 'source',
        });
        const outcome = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({
                only: ['project/source'],
                checks: {
                    'project/source': {
                        run: runBuiltInCheck(() => {
                            // eslint-disable-next-line @typescript-eslint/only-throw-error -- reason: This test proves the runner reports non-Error failures from external checks.
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
