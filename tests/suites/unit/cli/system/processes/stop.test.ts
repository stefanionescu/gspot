import { join } from 'node:path';
import { testdir } from 'testdirs';
import { pathToFileURL } from 'node:url';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { CLI_SOURCE_PATH } from '#tests/setup/cli/commands.ts';
import { spawnProcess, streamProcess } from '#cli/system/processes.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { isWindows, simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { CHILD_TIMEOUT_SECONDS, DESCENDANT_TIMEOUT_MILLISECONDS } from '#tests/config/system/processes.ts';
import { waitForExit, waitForFile, startCommand, limitToTestDeadline } from '#tests/setup/system/processes.ts';

/** Whether the supervisor stopped the child: a signal on a POSIX host, an exit code on Windows. */
function isStopped(child: childProcess.ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    if (isWindows) return child.exitCode !== null;
    return child.signalCode !== null;
}

/** Start a capture of an idle child, then fail the stdout stream of that child. */
function startFailedCapture(capture: 'text' | 'bytes', root: string) {
    using children = spyOn(childProcess, 'spawn');
    const running = captureProcess(capture, [process.execPath, '-e', 'setInterval(() => {}, 1000)'], { cwd: root });
    const launched = children.mock.results[0];
    if (launched?.type !== 'return') throw new Error('The capture started no child.');
    launched.value.stdout?.emit('error', new Error('Test stream failure.'));
    return { running, child: launched.value };
}

test('a failed text stream read stops the child and returns a failed result that names the stream error', async () => {
    await using sandbox = await testdir();
    const { running, child } = startFailedCapture('text', sandbox.path);
    try {
        const result = await running;
        // The line before it names the stop, which differs between POSIX signals and Windows exit codes.
        expect({
            timedOut: result.timedOut,
            canceled: result.canceled,
            missing: result.missing,
            lastLine: result.stderr.split('\n').at(-1),
        }).toStrictEqual({ timedOut: false, canceled: false, missing: false, lastLine: 'Test stream failure.' });
        expect(result.code).not.toBe(0);
        expect(isStopped(child)).toBe(true);
    } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test('a failed byte stream read stops the child and rejects with the stream error', async () => {
    await using sandbox = await testdir();
    const { running, child } = startFailedCapture('bytes', sandbox.path);
    try {
        expect(await captureRejection(running)).toBe('Test stream failure.');
        expect(isStopped(child)).toBe(true);
    } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test.each([
    ['text', 'timeout'],
    ['bytes', 'canceled'],
] as const)(
    '%s capture stops the descendants of a child stopped by %s',
    async (capture, termination) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'descendant-survived');
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log("descendant-ready"); setInterval(() => {}, 1000);`;
        const parent = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], {stdout:"inherit", stderr:"inherit"}); await Bun.sleep(60000);`;
        const controller = new AbortController();
        const running = captureProcess(capture, [process.execPath, '-e', parent], {
            cwd: sandbox.path,
            ...(termination === 'timeout' ? { timeoutSeconds: CHILD_TIMEOUT_SECONDS } : {}),
            ...(termination === 'canceled' ? { cancelSignal: controller.signal } : {}),
        });
        if (termination === 'canceled') {
            expect(await waitForFile(marker)).toBe(true);
            controller.abort();
        }
        if (capture === 'bytes') expect(await captureRejection(running)).toBe('The operation was aborted.');
        else {
            const result = await running;
            expect(Buffer.from(result.stdout).toString('utf8')).toBe('descendant-ready\n');
            expect(result.timedOut).toBe(termination === 'timeout');
            expect(result.canceled).toBe(termination === 'canceled');
        }
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
    DESCENDANT_TIMEOUT_MILLISECONDS,
);

test('an exiting CLI stops its running process group', async () => {
    await using sandbox = await testdir();
    const descendant = 'console.log(process.pid); setInterval(() => {}, 1000);';
    const sourceUrl = pathToFileURL(join(CLI_SOURCE_PATH, 'system/processes.ts')).href;
    const script = `import {spawnProcess} from ${JSON.stringify(sourceUrl)}; void spawnProcess([process.execPath,"-e",${JSON.stringify(descendant)}],{cwd:process.cwd(),onStdout(chunk){process.stdout.write(chunk);process.exit(19);}});`;
    const command = [process.execPath, '-e', script];
    await using started = startCommand(command, { cwd: sandbox.path });
    expect(await started.child.exited, await started.errors).toBe(19);
    const output = await started.output;
    const pid = Number(output.trim());
    expect(pid).toBeGreaterThan(0);
    await waitForExit(pid);
});

test('live output arrives before the process ends while capture keeps the output and exit code', async () => {
    await using sandbox = await testdir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const ready = Promise.withResolvers<undefined>();
    const release = join(sandbox.path, 'release');
    const child = `console.log('ready'); console.error('diagnostic'); while (!(await Bun.file(${JSON.stringify(release)}).exists())) await Bun.sleep(10); process.exitCode = 7;`;
    let finished = false;
    const running = captureProcess('text', [process.execPath, '-e', child], {
        cwd: sandbox.path,
        onStdout: (chunk) => {
            stdout.push(chunk);
            ready.resolve();
        },
        onStderr: (chunk) => {
            stderr.push(chunk);
        },
    }).then((result) => {
        finished = true;
        return result;
    });
    try {
        await Promise.race([
            ready.promise,
            running.then(() => {
                throw new Error('No live output.');
            }),
        ]);
        expect(finished).toBe(false);
        expect(stdout.join('')).toBe('ready\n');
    } finally {
        await writeFile(release, 'continue');
    }
    const result = await running;
    expect(result.code).toBe(7);
    expect(result.stdout).toBe(stdout.join(''));
    expect(result.stderr).toBe(stderr.join(''));
    expect(result.stderr).toBe('diagnostic\n');
});

test.each(['text', 'bytes'] as const)(
    '%s capture stops child processes that hold the output after the parent exits',
    async (capture) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'orphan-survived');
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log('ready'); setInterval(() => {}, 1000);`;
        const parent = `const child = Bun.spawn([process.execPath, '-e', ${JSON.stringify(descendant)}], {stdout:'pipe', stderr:'inherit'}); for await (const chunk of child.stdout) { process.stdout.write(chunk); process.exit(7); }`;
        const result = await captureProcess(capture, [process.execPath, '-e', parent], {
            cwd: sandbox.path,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toBe('ready\n');
        expect(result.timedOut).toBe(false);
        expect(result.canceled).toBe(false);
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test('the stop after a normal exit accepts the macOS refusal to signal an exited group', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    const signal = process.kill.bind(process);
    // macOS refuses to signal a group after its members exit, before their parent collects them.
    resources.use(
        spyOn(process, 'kill').mockImplementation((pid, kind) => {
            if (pid < 0) throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
            return signal(pid, kind);
        }),
    );
    using _operatingSystem = simulateOperatingSystem('darwin');

    const result = await captureProcess('text', [process.execPath, '-e', 'process.exit(0)'], {
        cwd: sandbox.path,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.errored).toBe(false);
});

test('stream reading keeps raw bytes and the error output', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        String.raw`process.stdout.write(Buffer.from([0,255,0,10])); process.stderr.write("diagnostic\n");`,
    ];
    const bytes: Buffer[] = [];
    const result = await streamProcess(
        command,
        { ...limitToTestDeadline(command, { cwd: sandbox.path }).options },
        async (chunks) => {
            for await (const chunk of chunks) bytes.push(chunk);
        },
    );
    expect(Buffer.concat(bytes)).toStrictEqual(Buffer.from([0, 255, 0, 10]));
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: 'diagnostic\n', missing: false });
});

test('a stream reader that throws stops its child process', async () => {
    await using sandbox = await testdir();
    using children = spyOn(childProcess, 'spawn');
    const failure = new Error('Consumer refused the bytes.');
    const command = [process.execPath, '-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000);'];
    expect(
        await streamProcess(
            command,
            { ...limitToTestDeadline(command, { cwd: sandbox.path }).options },
            async (chunks) => {
                for await (const chunk of chunks) {
                    expect(chunk.length).toBeGreaterThan(0);
                    throw failure;
                }
            },
        ).catch((error: unknown) => error),
    ).toBe(failure);
    const launched = children.mock.results[0];
    expect(launched?.type).toBe('return');
    if (launched?.type === 'return') expect(isStopped(launched.value)).toBe(true);
});

test('stream cancellation stops the child and keeps the cancellation reason', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    const reason = new Error('Canceled native output');
    let pid = 0;
    const command = [
        process.execPath,
        '-e',
        'process.stdout.write(String(process.pid)); setInterval(() => process.stdout.write("pending"), 1000);',
    ];
    expect(
        await streamProcess(
            command,
            {
                ...limitToTestDeadline(command, { cwd: sandbox.path }).options,
                cancelSignal: controller.signal,
            },
            async (chunks) => {
                for await (const chunk of chunks) {
                    pid = Number(chunk.toString());
                    expect(pid).toBeGreaterThan(0);
                    controller.abort(reason);
                }
            },
        ).catch((error: unknown) => error),
    ).toBe(reason);
    expect(controller.signal.aborted).toBe(true);
    await waitForExit(pid);
});

test('a finished stream keeps the reader error after cleanup', async () => {
    await using sandbox = await testdir();
    const refusal = new Error('Invalid native stream');
    const command = [process.execPath, '-e', 'process.stdout.write("invalid");'];
    expect(
        await streamProcess(
            command,
            { ...limitToTestDeadline(command, { cwd: sandbox.path }).options },
            async (chunks) => {
                for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
                throw refusal;
            },
        ).catch((error: unknown) => error),
    ).toBe(refusal);
});

/** Capture a command as text or bytes through the same test process timeout. */
async function captureProcess(
    capture: 'text' | 'bytes',
    command: string[],
    options: AsyncSpawnOptions,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: string | Buffer }> {
    if (capture === 'text') return spawnProcess(command, limitToTestDeadline(command, options).options);
    const chunks: Buffer[] = [];
    const result = await streamProcess(command, limitToTestDeadline(command, options).options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}
