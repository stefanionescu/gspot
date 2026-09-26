import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import * as childProcess from 'node:child_process';
import { run, runBinary } from '#cli/platform/spawn.ts';
import { waitForExit } from '#tests/support/cli/process.ts';

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
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log("descendant-ready"); setInterval(() => {}, 1000);`;
        const parent = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], {stdout:"inherit", stderr:"inherit"}); await Bun.sleep(10000);`;
        const result = await (capture === 'binary' ? runBinary : run)([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            timeoutMs: termination === 'timeout' ? 1500 : 5000,
            ...(termination === 'canceled' ? { cancelSignal: AbortSignal.timeout(1500) } : {}),
        });
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('descendant-ready');
        expect(result.isTimedOut).toBe(termination === 'timeout');
        expect(result.isCanceled).toBe(termination === 'canceled');
        expect(result.duration).toBeLessThan(2000);
        const pid = Number(readFileSync(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test('a CLI exit terminates its ready asynchronous process group', async () => {
    await using sandbox = await testdir();
    const descendant = 'console.log(process.pid); setInterval(() => {}, 1000);';
    const module = new URL('../../../../../packages/cli/src/platform/spawn.ts', import.meta.url).href;
    const script = `import {run} from ${JSON.stringify(module)}; void run([process.execPath,"-e",${JSON.stringify(descendant)}],{cwd:process.cwd(),onStdout(chunk){process.stdout.write(chunk);process.exit(19);}});`;
    const child = Bun.spawn([process.execPath, '-e', script], { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    const timer = setTimeout(() => {
        child.kill('SIGKILL');
    }, 5000);
    try {
        expect(await child.exited, await errors).toBe(19);
        const pid = Number((await output).trim());
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    } finally {
        clearTimeout(timer);
        if (child.exitCode === null) child.kill('SIGKILL');
        await child.exited;
        await output;
        await errors;
    }
});

test('live output arrives before completion while capture retains output and failure status', async () => {
    await using sandbox = await testdir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const ready = Promise.withResolvers<undefined>();
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
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log('ready'); setInterval(() => {}, 1000);`;
        const parent = `const child = Bun.spawn([process.execPath, '-e', ${JSON.stringify(descendant)}], {stdout:'pipe', stderr:'inherit'}); for await (const chunk of child.stdout) { process.stdout.write(chunk); process.exit(7); }`;
        const result = await (capture === 'binary' ? runBinary : run)([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            timeoutMs: 3000,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('ready');
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        expect(result.duration).toBeLessThan(2000);
        const pid = Number(readFileSync(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

if (process.platform !== 'win32')
    test('preserves execution and process-group permission errors', async () => {
        await using sandbox = await testdir();
        const original = process.kill.bind(process);
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
                expect(String((observed as AggregateError).errors[0])).toContain('exit code 7');
                expect((observed as AggregateError).errors[1]).toBe(denied);
            }
        } finally {
            signaling.mockRestore();
        }
    });
