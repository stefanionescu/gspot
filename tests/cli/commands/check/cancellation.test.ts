// Bun cancellation probes require POSIX signals so handlers can finish and dispose their children.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { startGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';
import { SLOW_CHECK, SLOW_TOOL_PROGRAM } from '#tests/config/cli/commands/check/cancellation.ts';

test.skipIf(!isPosix).each(['SIGINT', 'SIGTERM'] as const)(
    'check propagates %s to an active tool and reports cancellation',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[check."project/slow"]\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', SLOW_TOOL_PROGRAM])}\n`,
            }),
            'source.txt': 'input\n',
        });
        const child = startGspot(sandbox.path, SLOW_CHECK, {}, {});
        await using capture = captureChild(child);
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(await readFile(started, 'utf8'));
        child.kill(signal);
        expect(await child.exited, await capture.errors).toBe(2);
        const report = JSON.parse(await capture.output) as RunReport;
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]!.status).toBe('error');
        expect(report.checks[0]!.note).toContain('canceled');
        await waitForExit(toolPid);
    },
);
