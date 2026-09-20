// Exercise native dispatch and the production Windows backend on the current host.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import type { SpawnOptions } from '#types/platform.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { run, runBlocking, runOnWindows, runBlockingOnWindows } from '#cli/platform/spawn.ts';

const backends = [
    { name: 'native asynchronous', execute: run },
    { name: 'native synchronous', execute: runBlocking },
    {
        name: 'cross-spawn asynchronous',
        execute: (command: string[], options: SpawnOptions) =>
            runOnWindows(command[0]!, command.slice(1), options, performance.now()),
    },
    {
        name: 'cross-spawn synchronous',
        execute: (command: string[], options: SpawnOptions) =>
            runBlockingOnWindows(command[0]!, command.slice(1), options, performance.now()),
    },
];

for (const backend of backends) {
    describe(backend.name, () => {
        test.each([0, 1])('drains both large streams and preserves status %s', async (status) => {
            await using sandbox = await createSandbox({});
            const script = `const text = 'é'.repeat(1024 * 1024);
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = ${String(status)};`;
            const result = await backend.execute([process.execPath, '-e', script], {
                cwd: sandbox.path,
                timeoutMs: 5000,
            });
            expect(result.code).toBe(status);
            expect(result.stdout).toBe('é'.repeat(1024 * 1024));
            expect(result.stderr).toBe(result.stdout);
            expect(result.isTimedOut).toBe(false);
            expect(result.missing).toBe(false);
        });

        test('missing executable is a launch failure with diagnostics', async () => {
            await using sandbox = await createSandbox({});
            const result = await backend.execute([join(sandbox.path, 'missing-executable')], { cwd: sandbox.path });
            expect(result.code).toBe(127);
            expect(result.missing).toBe(true);
            expect(result.stderr).not.toBe('');
        });

        test.skipIf(process.platform === 'win32')('denied execution is distinct from a missing file', async () => {
            await using sandbox = await createSandbox({ 'denied.sh': '#!/bin/sh\nexit 0\n' });
            const executable = join(sandbox.path, 'denied.sh');
            chmodSync(executable, 0o600);
            const result = await backend.execute([executable], { cwd: sandbox.path });
            expect(result.code).not.toBe(0);
            expect(result.code).not.toBe(127);
            expect(result.missing).toBe(false);
            expect(result.stderr).not.toBe('');
        });

        test('a genuine deadline terminates the process and reports timeout', async () => {
            await using sandbox = await createSandbox({});
            const result = await backend.execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
                cwd: sandbox.path,
                timeoutMs: 150,
            });
            expect(result.isTimedOut).toBe(true);
            expect(result.code).not.toBe(0);
            expect(result.duration).toBeLessThan(3000);
        });

        test('a signal before the deadline is not a timeout', async () => {
            await using sandbox = await createSandbox({});
            const result = await backend.execute([process.execPath, '-e', "process.kill(process.pid, 'SIGTERM')"], {
                cwd: sandbox.path,
                timeoutMs: 5000,
            });
            expect(result.isTimedOut).toBe(false);
            expect(result.code).not.toBe(0);
            expect(result.missing).toBe(false);
        });
    });
}

test.skipIf(process.platform === 'win32')('a failed stream read terminates the owned Bun child', async () => {
    await using sandbox = await createSandbox({});
    const children = spyOn(Bun, 'spawn');
    const stream = spyOn(Response.prototype, 'text').mockRejectedValueOnce(new Error('Planted stream failure.'));
    try {
        const result = await run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { cwd: sandbox.path });
        expect(result.code).not.toBe(0);
        expect(result.missing).toBe(false);
        expect(result.stderr).toContain('Planted stream failure');
        const child = children.mock.results[0];
        expect(child?.type).toBe('return');
        if (child?.type === 'return') expect(child.value.signalCode).not.toBeNull();
    } finally {
        children.mockRestore();
        stream.mockRestore();
    }
});
