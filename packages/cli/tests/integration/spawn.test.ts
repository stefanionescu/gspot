// Exercise the shared process contract through real child processes.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import * as childProcess from 'node:child_process';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, spyOn, test } from 'bun:test';
import { run, runBlocking, runBinary } from '#cli/platform/spawn.ts';

const backends = [
    { name: 'asynchronous', execute: run },
    { name: 'synchronous', execute: runBlocking },
];

for (const backend of backends) {
    describe(backend.name, () => {
        test.each([0, 1])('drains both large streams and preserves status %s', async (status) => {
            await using sandbox = await testdir();
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
            await using sandbox = await testdir();
            const result = await backend.execute([join(sandbox.path, 'missing-executable')], { cwd: sandbox.path });
            expect(result.code).toBe(127);
            expect(result.missing).toBe(true);
            expect(result.stderr).not.toBe('');
        });

        test.skipIf(process.platform === 'win32')('denied execution is distinct from a missing file', async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'denied.sh': '#!/bin/sh\nexit 0\n' });
            const executable = join(sandbox.path, 'denied.sh');
            chmodSync(executable, 0o600);
            const result = await backend.execute([executable], { cwd: sandbox.path });
            expect(result.code).not.toBe(0);
            expect(result.code).not.toBe(127);
            expect(result.missing).toBe(false);
            expect(result.stderr).not.toBe('');
        });

        test('a genuine deadline terminates the process and reports timeout', async () => {
            await using sandbox = await testdir();
            const result = await backend.execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
                cwd: sandbox.path,
                timeoutMs: 150,
            });
            expect(result.isTimedOut).toBe(true);
            expect(result.code).not.toBe(0);
            expect(result.duration).toBeLessThan(3000);
        });

        test('a signal before the deadline is not a timeout', async () => {
            await using sandbox = await testdir();
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

test('cancellation terminates the process without reporting a timeout', async () => {
    await using sandbox = await testdir();
    const result = await run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: sandbox.path,
        timeoutMs: 5000,
        cancelSignal: AbortSignal.timeout(150),
    });
    expect(result.isCanceled).toBe(true);
    expect(result.isTimedOut).toBe(false);
    expect(result.code).not.toBe(0);
    expect(result.duration).toBeLessThan(3000);
});

test('preserves stdin, argument boundaries, final newlines, and the requested environment', async () => {
    await using sandbox = await testdir();
    const input = 'line one\nline two\n';
    for (const backend of backends) {
        const result = await backend.execute(
            [
                process.execPath,
                '-e',
                String.raw`
            const text = await new Response(Bun.stdin.stream()).text();
            process.stdout.write(JSON.stringify({ text, args: process.argv.slice(1), value: process.env.GSPOT_PROCESS_CASE, cwd: process.cwd() }) + '\n');
        `,
                'space separated',
                '$(echo must-stay-literal)',
            ],
            {
                cwd: sandbox.path,
                env: { GSPOT_PROCESS_CASE: 'selected' },
                stdin: input,
            },
        );
        expect(result.code).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual({
            text: input,
            args: ['space separated', '$(echo must-stay-literal)'],
            value: 'selected',
            cwd: sandbox.path,
        });
        expect(result.stdout.endsWith('\n')).toBe(true);
    }
});

test('explicitly removes inherited environment values', async () => {
    await using sandbox = await testdir();
    for (const backend of backends) {
        const result = await backend.execute(
            [process.execPath, '-e', 'process.stdout.write(String(process.env.PATH === undefined))'],
            {
                cwd: sandbox.path,
                env: { PATH: undefined },
            },
        );
        expect(result.code).toBe(0);
        expect(result.stdout).toBe('true');
    }
});

test('a failed stream read terminates the owned child', async () => {
    await using sandbox = await testdir();
    const children = spyOn(childProcess, 'spawn');
    let child: childProcess.ChildProcess | undefined;
    try {
        const running = run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
            cwd: sandbox.path,
            timeoutMs: 3000,
        });
        const launched = children.mock.results[0];
        if (launched?.type === 'return') {
            child = launched.value;
            child.stdout?.emit('error', new Error('Planted stream failure.'));
        }
        const result = await running;
        expect(result.duration).toBeLessThan(1500);
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        expect(result.code).not.toBe(0);
        expect(result.missing).toBe(false);
        expect(result.stderr).toContain('Planted stream failure');
        expect(child).toBeDefined();
        expect(child?.signalCode).not.toBeNull();
    } finally {
        children.mockRestore();
        if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test('binary capture preserves invalid UTF-8 and classifies cancellation and deadlines', async () => {
    await using sandbox = await testdir();
    const result = await runBinary(
        [
            process.execPath,
            '-e',
            String.raw`process.stdout.write(Buffer.from([0, 255, 128, 10])); process.stderr.write("diagnostic\n");`,
        ],
        { cwd: sandbox.path },
    );
    expect([...result.stdout]).toEqual([0, 255, 128, 10]);
    expect(result.stderr).toBe('diagnostic\n');
    expect(result.code).toBe(0);
    const canceled = await runBinary([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: sandbox.path,
        timeoutMs: 5000,
        cancelSignal: AbortSignal.timeout(100),
    });
    expect(canceled.isCanceled).toBe(true);
    expect(canceled.isTimedOut).toBe(false);
    expect(canceled.code).not.toBe(0);
    const timedOut = await runBinary([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: sandbox.path,
        timeoutMs: 100,
    });
    expect(timedOut.isTimedOut).toBe(true);
    expect(timedOut.isCanceled).toBe(false);
    expect(timedOut.code).not.toBe(0);
});
