// Exercise the shared process contract through real child processes.
import { join } from 'node:path';
import { chmodSync, existsSync } from 'node:fs';
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
        test('a selected executable resolves its sibling commands before unrelated PATH tools', async () => {
            await using sandbox = await testdir();
            const extension = process.platform === 'win32' ? '.cmd' : '';
            const script = (command: string) =>
                process.platform === 'win32' ? `@echo off\r\n${command}\r\n` : `#!/bin/sh\n${command}\n`;
            await createFileTree(sandbox.path, {
                [`selected/parent${extension}`]: script('sibling'),
                [`selected/sibling${extension}`]: script('echo selected'),
                [`unrelated/sibling${extension}`]: script('echo unrelated'),
            });
            for (const path of ['selected/parent', 'selected/sibling', 'unrelated/sibling'])
                chmodSync(join(sandbox.path, path + extension), 0o755);
            const result = await backend.execute([join(sandbox.path, `selected/parent${extension}`)], {
                cwd: sandbox.path,
                env: { PATH: join(sandbox.path, 'unrelated') },
            });
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout.trim()).toBe('selected');
        });
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
            expect(result.isErrored).toBe(true);
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
        expect(JSON.parse(result.stdout)).toStrictEqual({
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

test.each(['text', 'binary'] as const)('a failed %s stream read terminates the owned child', async (capture) => {
    await using sandbox = await testdir();
    const children = spyOn(childProcess, 'spawn');
    let child: childProcess.ChildProcess | undefined;
    try {
        const running = (capture === 'binary' ? runBinary : run)(
            [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
            {
                cwd: sandbox.path,
                timeoutMs: 3000,
            },
        );
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
    expect([...result.stdout]).toStrictEqual([0, 255, 128, 10]);
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

test.each([
    ['text', 'timeout'],
    ['text', 'canceled'],
    ['binary', 'timeout'],
    ['binary', 'canceled'],
] as const)(
    '%s capture stops descendants on %s before they can write after the deadline',
    async (capture, termination) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'descendant-survived');
        const descendant = `console.log("descendant-ready"); await Bun.sleep(700); await Bun.write(${JSON.stringify(marker)}, "survived");`;
        const parent = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], {stdout:"inherit", stderr:"inherit"}); await Bun.sleep(10000);`;
        const result = await (capture === 'binary' ? runBinary : run)([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            timeoutMs: termination === 'timeout' ? 250 : 5000,
            ...(termination === 'canceled' ? { cancelSignal: AbortSignal.timeout(250) } : {}),
        });
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('descendant-ready');
        expect(result.isTimedOut).toBe(termination === 'timeout');
        expect(result.isCanceled).toBe(termination === 'canceled');
        expect(result.duration).toBeLessThan(2000);
        await Bun.sleep(800);
        expect(existsSync(marker)).toBe(false);
    },
);

test('a CLI exit terminates its owned asynchronous process group', async () => {
    await using sandbox = await testdir();
    const marker = join(sandbox.path, 'orphan-survived');
    const descendant = `console.log("owned-child-ready"); await Bun.sleep(700); await Bun.write(${JSON.stringify(marker)}, "survived");`;
    const module = new URL('../../../packages/cli/src/platform/spawn.ts', import.meta.url).href;
    const script = `import {run} from ${JSON.stringify(module)}; void run([process.execPath,"-e",${JSON.stringify(descendant)}],{cwd:process.cwd()}); await Bun.sleep(250); process.exit(19);`;
    const result = await run([process.execPath, '-e', script], { cwd: sandbox.path, timeoutMs: 5000 });
    expect(result.code).toBe(19);
    await Bun.sleep(800);
    expect(existsSync(marker)).toBe(false);
});

test('live output arrives before completion while capture retains output and failure status', async () => {
    await using sandbox = await testdir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const ready = Promise.withResolvers<void>();
    const release = join(sandbox.path, 'release');
    const child = `console.log('ready'); console.error('diagnostic'); while (!(await Bun.file(${JSON.stringify(release)}).exists())) await Bun.sleep(10); process.exitCode = 7;`;
    let completed = false;
    const running = run([process.execPath, '-e', child], {
        cwd: sandbox.path,
        timeoutMs: 5000,
        onStdout: (chunk) => {
            stdout.push(chunk);
            ready.resolve();
        },
        onStderr: (chunk) => {
            stderr.push(chunk);
        },
    }).then((result) => {
        completed = true;
        return result;
    });
    try {
        await Promise.race([
            ready.promise,
            running.then(() => {
                throw new Error('No live output.');
            }),
        ]);
        expect(completed).toBe(false);
        expect(stdout.join('')).toContain('ready');
    } finally {
        await Bun.write(release, 'continue');
    }
    const result = await running;
    expect(result.code).toBe(7);
    expect(result.stdout).toBe(stdout.join(''));
    expect(result.stderr).toBe(stderr.join(''));
    expect(result.stderr).toContain('diagnostic');
});

test.each(['text', 'binary'] as const)(
    '%s capture reaps descendants holding output after an ordinary parent exit',
    async (capture) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'orphan-survived');
        const descendant = `console.log('ready'); await Bun.sleep(700); await Bun.write(${JSON.stringify(marker)}, 'survived');`;
        const parent = `Bun.spawn([process.execPath, '-e', ${JSON.stringify(descendant)}], {stdout:'inherit', stderr:'inherit'}); await Bun.sleep(150); process.exit(7);`;
        const result = await (capture === 'binary' ? runBinary : run)([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            timeoutMs: 3000,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('ready');
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        expect(result.duration).toBeLessThan(2000);
        await Bun.sleep(800);
        expect(existsSync(marker)).toBe(false);
    },
);

test.skipIf(process.platform === 'win32')('preserves execution and process-group permission errors', async () => {
    await using sandbox = await testdir();
    const original = process.kill;
    const denied = Object.assign(new Error('Group permission denied.'), { code: 'EPERM' });
    const signaling = spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid < 0) throw denied;
        return original(pid, signal);
    });
    try {
        for (const execute of [run, runBinary]) {
            let observed: unknown;
            try {
                await execute([process.execPath, '-e', "console.error('tool failed'); process.exitCode = 7"], {
                    cwd: sandbox.path,
                });
            } catch (error) {
                observed = error;
            }
            expect(observed).toBeInstanceOf(AggregateError);
            expect((observed as AggregateError).errors[0].message).toContain('exit code 7');
            expect((observed as AggregateError).errors[1]).toBe(denied);
        }
    } finally {
        signaling.mockRestore();
    }
});
