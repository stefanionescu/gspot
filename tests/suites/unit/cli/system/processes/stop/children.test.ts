import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { CHILD_TIMEOUT_SECONDS } from '#tests/config/setup/programs.ts';
import { runProcess, streamProcess } from '#cli/system/processes/run.ts';
import { isWindows, fakePlatform } from '#tests/setup/system/platform.ts';
import { STREAM_FAILURE, STOPPED_CAPTURES } from '#tests/config/system.ts';
import type { SpawnResult, CancelableSpawnOptions } from '#cli/types/system.ts';
import { waitForExit, waitForFile, limitCommand, spawnCommand } from '#tests/setup/system/processes.ts';

async function stopTool(root: string, script: string): Promise<Awaited<ReturnType<typeof runProcess>>> {
    using children = spyOn(childProcess, 'spawn');
    const controller = new AbortController();
    const running = runProcess(['sh', '-c', script], {
        cwd: root,
        cancelSignal: controller.signal,
        timeoutSeconds: CHILD_TIMEOUT_SECONDS,
    });
    const launched = children.mock.results[0];
    if (launched?.type !== 'return' || launched.value.pid === undefined) throw new Error('The stop started no child.');
    const isReady = await waitForFile(join(root, 'ready'));
    controller.abort();
    const result = await running;
    await waitForExit(-launched.value.pid);
    expect(isReady).toBe(true);
    expect(result.end).toBe('canceled');
    return result;
}

async function captureProcess(
    capture: 'text' | 'bytes',
    command: string[],
    options: CancelableSpawnOptions,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: string | Buffer }> {
    const bounded = {
        timeoutSeconds: CHILD_TIMEOUT_SECONDS,
        ...options,
    };
    if (capture === 'text') return runProcess(command, limitCommand(command, bounded).options);
    const chunks: Buffer[] = [];
    const result = await streamProcess(command, limitCommand(command, bounded).options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}

test('a failed byte stream read stops the child and rejects with the stream error', async () => {
    await using sandbox = await testdir();
    using children = spyOn(childProcess, 'spawn');
    const running = captureProcess('bytes', buildProgramCommand('fakes/tool', '--wait'), { cwd: sandbox.path });
    const launched = children.mock.results[0];
    if (launched?.type !== 'return') throw new Error('The capture started no child.');
    const child = launched.value;
    child.stdout?.emit('error', new Error(STREAM_FAILURE));
    try {
        const runningError = await captureRejection(running);
        expect(runningError.message).toBe(STREAM_FAILURE);
        expect(isWindows ? child.exitCode : child.signalCode).not.toBeNull();
    } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test.each([...STOPPED_CAPTURES])(
    '%s capture stops the descendants of a child stopped by %s',
    async (capture, termination) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'descendant-survived');
        const parent = buildProgramCommand('processes/descendant', '--marker', marker, '--line', 'descendant-ready');
        const controller = new AbortController();
        const running = captureProcess(capture, parent, {
            cwd: sandbox.path,
            ...(termination === 'timeout' && { timeoutSeconds: 1 }),
            ...(termination === 'canceled' && { cancelSignal: controller.signal }),
        });
        if (termination === 'canceled') {
            expect(await waitForFile(marker)).toBe(true);
            controller.abort();
        }
        if (capture === 'bytes') {
            const abortError = await captureRejection(running);
            expect(abortError.name).toBe('AbortError');
        } else {
            const result = await running;
            expect(Buffer.from(result.stdout).toString('utf8')).toBe('descendant-ready\n');
            expect(result.end).toBe(termination === 'timeout' ? 'timed-out' : 'canceled');
        }
        const pid = Number(await readFile(marker, 'utf8'));
        await waitForExit(pid);
    },
);

test('an exiting CLI stops its running process group', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('processes/process-group', '19');
    await using started = spawnCommand(command, {
        cwd: sandbox.path,
        timeoutSeconds: CHILD_TIMEOUT_SECONDS,
    });
    expect(await started.child.exited, await started.stderr).toBe(19);
    const output = await started.stdout;
    const pid = Number(output.trim());
    await waitForExit(pid);
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
        expect(result.end).toBe('exited');
        const pid = Number(await readFile(marker, 'utf8'));
        await waitForExit(pid);
    },
);

test('the stop after a normal exit accepts the macOS refusal to signal an exited group', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    const kill: typeof process.kill = process.kill.bind(process);
    resources.use(
        spyOn(process, 'kill').mockImplementation((pid, kind) => {
            if (pid < 0) throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
            return kill(pid, kind);
        }),
    );
    using _operatingSystem = fakePlatform('darwin');

    const result = await captureProcess('text', buildProgramCommand('fakes/tool'), {
        cwd: sandbox.path,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.end).toBe('exited');
});

test.skipIf(isWindows)('a stopped tool gets SIGTERM, so it can clean up before it exits', async () => {
    await using sandbox = await testdir();
    await stopTool(
        sandbox.path,
        `trap 'echo cleaned > cleaned; exit 3' TERM; echo ready > ready; while :; do sleep 0.02; done`,
    );
    expect(await readFile(join(sandbox.path, 'cleaned'), 'utf8')).toBe('cleaned\n');
});

test.skipIf(isWindows)('a tool that ignores SIGTERM stops with SIGKILL', async () => {
    await using sandbox = await testdir();
    await stopTool(sandbox.path, `trap '' TERM; echo ready > ready; while :; do sleep 0.02; done`);
});
