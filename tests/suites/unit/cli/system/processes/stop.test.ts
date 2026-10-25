import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { spawnProcess, streamProcess } from '#cli/system/processes.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { isWindows, simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { waitForExit, waitForFile, startCommand, limitCommand } from '#tests/setup/system/processes.ts';
import { CHILD_TIMEOUT_SECONDS, DESCENDANT_TIMEOUT_MILLISECONDS } from '#tests/config/system/processes.ts';

function isStopped(child: childProcess.ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    return (isWindows ? child.exitCode : child.signalCode) !== null;
}

function startFailedCapture(capture: 'text' | 'bytes', root: string) {
    using children = spyOn(childProcess, 'spawn');
    const running = captureProcess(capture, buildProgramCommand('fakes/tool', '--wait'), { cwd: root });
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
        const runningError = await captureRejection(running);
        expect(runningError.message).toBe('Test stream failure.');
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
        const parent = buildProgramCommand('processes/descendant', '--marker', marker, '--line', 'descendant-ready');
        const controller = new AbortController();
        const running = captureProcess(capture, parent, {
            cwd: sandbox.path,
            ...(termination === 'timeout' && { timeoutSeconds: CHILD_TIMEOUT_SECONDS }),
            ...(termination === 'canceled' && { cancelSignal: controller.signal }),
        });
        if (termination === 'canceled') {
            expect(await waitForFile(marker)).toBe(true);
            controller.abort();
        }
        if (capture === 'bytes') {
            const abortError = await captureRejection(running);
            expect(abortError.message).toBe('The operation was aborted.');
        } else {
            const result = await running;
            expect(Buffer.from(result.stdout).toString('utf8')).toBe('descendant-ready\n');
            expect(result.timedOut).toBe(termination === 'timeout');
            expect(result.canceled).toBe(termination === 'canceled');
        }
        const pid = Number(await readFile(marker, 'utf8'));
        await waitForExit(pid);
    },
    DESCENDANT_TIMEOUT_MILLISECONDS,
);

test('an exiting CLI stops its running process group', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('processes/process-group', '19');
    await using started = startCommand(command, { cwd: sandbox.path });
    expect(await started.child.exited, await started.errors).toBe(19);
    const output = await started.output;
    const pid = Number(output.trim());
    await waitForExit(pid);
});

test('live output arrives before the process ends while capture keeps the output and exit code', async () => {
    await using sandbox = await testdir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const ready = Promise.withResolvers<undefined>();
    const release = join(sandbox.path, 'release');
    const child = buildProgramCommand(
        'fakes/tool',
        '--line',
        'ready',
        '--stderr',
        'diagnostic\n',
        '--until',
        release,
        '--exit',
        '7',
    );
    let isFinished = false;
    const running = (async () => {
        const result = await captureProcess('text', child, {
            cwd: sandbox.path,
            onStdout: (chunk) => {
                stdout.push(chunk);
                ready.resolve();
            },
            onStderr: (chunk) => {
                stderr.push(chunk);
            },
        });
        isFinished = true;
        return result;
    })();
    try {
        await Promise.race([ready.promise, running]);
        expect(isFinished).toBe(false);
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
        const parent = buildProgramCommand(
            'processes/descendant',
            '--marker',
            marker,
            '--line',
            'ready',
            '--forward',
            '7',
        );
        const result = await captureProcess(capture, parent, {
            cwd: sandbox.path,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toBe('ready\n');
        expect(result.timedOut).toBe(false);
        expect(result.canceled).toBe(false);
        const pid = Number(await readFile(marker, 'utf8'));
        await waitForExit(pid);
    },
);

test('the stop after a normal exit accepts the macOS refusal to signal an exited group', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    const kill = process.kill.bind(process);
    resources.use(
        spyOn(process, 'kill').mockImplementation((pid, kind) => {
            if (pid < 0) throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
            return kill(pid, kind);
        }),
    );
    using _operatingSystem = simulateOperatingSystem('darwin');

    const result = await captureProcess('text', buildProgramCommand('fakes/tool'), {
        cwd: sandbox.path,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.errored).toBe(false);
});

test('stream reading keeps raw bytes and the error output', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('fakes/tool', '--stdout-hex', '00ff000a', '--stderr', 'diagnostic\n');
    const bytes: Buffer[] = [];
    const result = await streamProcess(
        command,
        { ...limitCommand(command, { cwd: sandbox.path }).options },
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
    const command = buildProgramCommand('fakes/tool', '--stdout', 'ready', '--wait');
    const error = await captureRejection(
        streamProcess(command, { ...limitCommand(command, { cwd: sandbox.path }).options }, async (chunks) => {
            for await (const chunk of chunks) {
                expect(Buffer.from(chunk).toString('utf8')).toBe('ready');
                throw failure;
            }
        }),
    );
    expect(error).toBe(failure);
    const launched = children.mock.results[0];
    expect(launched?.type).toBe('return');
    if (launched?.type === 'return') expect(isStopped(launched.value)).toBe(true);
});

test('stream cancellation stops the child and keeps the cancellation reason', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    const reason = new Error('Canceled native output');
    let pid = 0;
    const command = buildProgramCommand('fakes/tool', '--print-pid', '--wait', '--repeat', 'pending');
    const error = await captureRejection(
        streamProcess(
            command,
            {
                ...limitCommand(command, { cwd: sandbox.path }).options,
                cancelSignal: controller.signal,
            },
            async (chunks) => {
                for await (const chunk of chunks) {
                    pid = Number(chunk.toString());
                    controller.abort(reason);
                }
            },
        ),
    );
    expect(error).toBe(reason);
    expect(controller.signal.aborted).toBe(true);
    await waitForExit(pid);
});

test('a finished stream keeps the reader error after cleanup', async () => {
    await using sandbox = await testdir();
    const refusal = new Error('Invalid native stream');
    const command = buildProgramCommand('fakes/tool', '--stdout', 'invalid');
    const error = await captureRejection(
        streamProcess(command, { ...limitCommand(command, { cwd: sandbox.path }).options }, async (chunks) => {
            for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
            throw refusal;
        }),
    );
    expect(error).toBe(refusal);
});

async function captureProcess(
    capture: 'text' | 'bytes',
    command: string[],
    options: AsyncSpawnOptions,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: string | Buffer }> {
    if (capture === 'text') return spawnProcess(command, limitCommand(command, options).options);
    const chunks: Buffer[] = [];
    const result = await streamProcess(command, limitCommand(command, options).options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}
