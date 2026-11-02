import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runProcess, streamProcess } from '#cli/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { isWindows, fakePlatform } from '#tests/setup/system/platform.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system.ts';
import { CLEANING_TOOL, STUBBORN_TOOL, STREAM_FAILURE, STOPPED_CAPTURES } from '#tests/config/system.ts';

import {
    isStopped,
    waitForExit,
    waitForFile,
    spawnCommand,
    limitCommand,
    CHILD_TIMEOUT_SECONDS,
} from '#tests/setup/system/processes.ts';

function startFailedCapture(capture: 'text' | 'bytes', root: string) {
    using children = spyOn(childProcess, 'spawn');
    const running = captureProcess(capture, buildProgramCommand('fakes/tool', '--wait'), { cwd: root });
    const launched = children.mock.results[0];
    if (launched?.type !== 'return') throw new Error('The capture started no child.');
    launched.value.stdout?.emit('error', new Error(STREAM_FAILURE));
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
        }).toStrictEqual({ timedOut: false, canceled: false, missing: false, lastLine: STREAM_FAILURE });
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
        expect(runningError.message).toBe(STREAM_FAILURE);
        expect(isStopped(child)).toBe(true);
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
    using _operatingSystem = fakePlatform('darwin');

    const result = await captureProcess('text', buildProgramCommand('fakes/tool'), {
        cwd: sandbox.path,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.errored).toBe(false);
});

async function stopTool(root: string, script: string): Promise<Awaited<ReturnType<typeof runProcess>>> {
    const controller = new AbortController();
    const running = runProcess(['sh', '-c', script], {
        cwd: root,
        cancelSignal: controller.signal,
        timeoutSeconds: CHILD_TIMEOUT_SECONDS,
    });
    expect(await waitForFile(join(root, 'ready'))).toBe(true);
    controller.abort();
    const result = await running;
    expect(result.canceled).toBe(true);
    return result;
}

test.skipIf(isWindows)('a stopped tool gets SIGTERM, so it can clean up before it exits', async () => {
    await using sandbox = await testdir();
    await stopTool(sandbox.path, CLEANING_TOOL);
    expect(await readFile(join(sandbox.path, 'cleaned'), 'utf8')).toBe('cleaned\n');
});

test.skipIf(isWindows)('a tool that ignores SIGTERM stops with SIGKILL', async () => {
    await using sandbox = await testdir();
    const result = await stopTool(sandbox.path, STUBBORN_TOOL);
    expect(result.code).not.toBe(0);
});

async function captureProcess(
    capture: 'text' | 'bytes',
    command: string[],
    options: AsyncSpawnOptions,
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
