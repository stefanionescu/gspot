import { join } from 'node:path';
import { testdir } from 'testdirs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { rejects } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { waitForExit } from '#tests/harness/process.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { run, runBinary, runStream } from '#cli/platform/public.ts';
import type { AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

const captures = {
    text: (command: string[], options: AsyncSpawnOptions) =>
        run(command, prepareTestCommand(command, options, 'text capture').options),
    binary: (command: string[], options: AsyncSpawnOptions) =>
        runBinary(command, prepareTestCommand(command, options, 'binary capture').options),
};

// What the supervisor leaves on a child it stopped: a signal on a POSIX host, an exit code on Windows.
function terminated(child: childProcess.ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    if (process.platform === 'win32') return child.exitCode !== null;
    return child.signalCode !== null;
}

test.each(['text', 'binary'] as const)('a failed %s stream read terminates the owned child', async (capture) => {
    await using sandbox = await testdir();
    const children = spyOn(childProcess, 'spawn');
    let child: childProcess.ChildProcess | undefined;
    try {
        const running = captures[capture]([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
            cwd: sandbox.path,
        });
        const launched = children.mock.results[0];
        if (launched?.type === 'return') {
            child = launched.value;
            child.stdout?.emit('error', new Error('Test stream failure.'));
        }
        const result = await running;
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        expect(result.code).not.toBe(0);
        expect(result.missing).toBe(false);
        expect(result.stderr).toContain('Test stream failure');
        expect(terminated(child)).toBe(true);
    } finally {
        children.mockRestore();
        if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test('binary capture preserves invalid UTF-8 bytes and diagnostic output', async () => {
    await using sandbox = await testdir();
    const result = await captures.binary(
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
});

test.each([
    ['text', 'timeout'],
    ['binary', 'canceled'],
] as const)(
    '%s capture stops descendants on %s before they can write after the deadline',
    async (capture, termination) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'descendant-survived');
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log("descendant-ready"); setInterval(() => {}, 1000);`;
        const parent = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], {stdout:"inherit", stderr:"inherit"}); await Bun.sleep(10000);`;
        const result = await captures[capture]([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            ...(termination === 'timeout' ? { timeoutMs: 1500 } : {}),
            ...(termination === 'canceled' ? { cancelSignal: AbortSignal.timeout(1500) } : {}),
        });
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('descendant-ready');
        expect(result.isTimedOut).toBe(termination === 'timeout');
        expect(result.isCanceled).toBe(termination === 'canceled');
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test('a CLI exit terminates its ready asynchronous process group', async () => {
    await using sandbox = await testdir();
    const descendant = 'console.log(process.pid); setInterval(() => {}, 1000);';
    const sourceUrl = pathToFileURL(join(root, 'packages/cli/src/platform/public.ts')).href;
    const script = `import {run} from ${JSON.stringify(sourceUrl)}; void run([process.execPath,"-e",${JSON.stringify(descendant)}],{cwd:process.cwd(),onStdout(chunk){process.stdout.write(chunk);process.exit(19);}});`;
    const command = [process.execPath, '-e', script];
    const prepared = prepareTestCommand(command, { cwd: sandbox.path }, 'CLI process-group exit');
    const child = Bun.spawn(command, {
        cwd: sandbox.path,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
        killSignal: 'SIGKILL',
    });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    try {
        expect(await child.exited, await errors).toBe(19);
        const printed = await output;
        const pid = Number(printed.trim());
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    } finally {
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
    const running = captures
        .text([process.execPath, '-e', child], {
            cwd: sandbox.path,
            onStdout: (chunk) => {
                stdout.push(chunk);
                ready.resolve();
            },
            onStderr: (chunk) => {
                stderr.push(chunk);
            },
        })
        .then((result) => {
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
        const result = await captures[capture]([process.execPath, '-e', parent], {
            cwd: sandbox.path,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('ready');
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test.skipIf(process.platform === 'win32')(
    'the reap after an ordinary exit accepts a macOS refusal to signal a group that has exited',
    async () => {
        await using sandbox = await testdir();
        const signal = process.kill.bind(process);
        // macOS refuses to signal a process group whose members have exited but are not reaped yet.
        const refused = spyOn(process, 'kill').mockImplementation((pid, kind) => {
            if (pid < 0) throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
            return signal(pid, kind);
        });
        const platform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        try {
            const result = await captures.text([process.execPath, '-e', 'process.exit(0)'], {
                cwd: sandbox.path,
            });
            expect(result.code, result.stderr).toBe(0);
            expect(result.isErrored).toBe(false);
        } finally {
            Object.defineProperty(process, 'platform', { value: platform });
            refused.mockRestore();
        }
    },
);

test('stream consumption preserves raw bytes without captured output and retains diagnostics', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        String.raw`process.stdout.write(Buffer.from([0,255,0,10])); process.stderr.write("diagnostic\n");`,
    ];
    const bytes: Buffer[] = [];
    const result = await runStream(
        command,
        prepareTestCommand(command, { cwd: sandbox.path }, 'raw stream').options,
        async (chunks) => {
            for await (const chunk of chunks) bytes.push(chunk);
        },
    );
    expect(Buffer.concat(bytes)).toStrictEqual(Buffer.from([0, 255, 0, 10]));
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: 'diagnostic\n', missing: false });
});

test('a rejected stream consumer terminates and drains its owned child', async () => {
    await using sandbox = await testdir();
    const children = spyOn(childProcess, 'spawn');
    const failure = new Error('Consumer refused the bytes.');
    const command = [process.execPath, '-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000);'];
    try {
        await rejects(
            runStream(
                command,
                prepareTestCommand(command, { cwd: sandbox.path }, 'rejected stream').options,
                async (chunks) => {
                    for await (const chunk of chunks) {
                        expect(chunk.length).toBeGreaterThan(0);
                        throw failure;
                    }
                },
            ),
            failure,
        );
        const launched = children.mock.results[0];
        expect(launched?.type).toBe('return');
        if (launched?.type === 'return') expect(terminated(launched.value)).toBe(true);
    } finally {
        children.mockRestore();
    }
});

test('stream cancellation terminates the child and preserves the cancellation reason', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    const reason = new Error('Canceled native output');
    let pid = 0;
    const command = [
        process.execPath,
        '-e',
        'process.stdout.write(String(process.pid)); setInterval(() => process.stdout.write("pending"), 1000);',
    ];
    await rejects(
        runStream(
            command,
            {
                ...prepareTestCommand(command, { cwd: sandbox.path }, 'canceled stream').options,
                cancelSignal: controller.signal,
            },
            async (chunks) => {
                for await (const chunk of chunks) {
                    pid = Number(chunk.toString());
                    expect(pid).toBeGreaterThan(0);
                    controller.abort(reason);
                }
            },
        ),
        (error) => error === reason,
    );
    expect(controller.signal.aborted).toBe(true);
    await waitForExit(pid);
});

test('a completed native stream retains the consumer refusal after process cleanup', async () => {
    await using sandbox = await testdir();
    const refusal = new Error('Invalid native stream');
    const command = [process.execPath, '-e', 'process.stdout.write("invalid");'];
    await rejects(
        runStream(
            command,
            prepareTestCommand(command, { cwd: sandbox.path }, 'completed invalid stream').options,
            async (chunks) => {
                for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
                throw refusal;
            },
        ),
        (error) => error === refusal,
    );
});
