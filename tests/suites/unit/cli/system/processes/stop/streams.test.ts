import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { streamProcess } from '#cli/system/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { waitForExit } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { UNIT_TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/runner.ts';

const timeoutSeconds = (UNIT_TEST_TIMEOUT_MILLISECONDS - MILLISECONDS_PER_SECOND) / MILLISECONDS_PER_SECOND;

function isStopped(child: childProcess.ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    return (isWindows ? child.exitCode : child.signalCode) !== null;
}

test('stream reading keeps raw bytes and the error output', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('fakes/tool', '--stdout-hex', '00ff000a', '--stderr', 'diagnostic\n');
    const bytes: Buffer[] = [];
    const result = await streamProcess(
        command,
        {
            cwd: sandbox.path,
            timeoutSeconds,
        },
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
        streamProcess(
            command,
            {
                cwd: sandbox.path,
                timeoutSeconds,
            },
            async (chunks) => {
                for await (const chunk of chunks) {
                    expect(Buffer.from(chunk).toString('utf8')).toBe('ready');
                    throw failure;
                }
            },
        ),
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
                cwd: sandbox.path,
                timeoutSeconds,
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
        streamProcess(
            command,
            {
                cwd: sandbox.path,
                timeoutSeconds,
            },
            async (chunks) => {
                for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
                throw refusal;
            },
        ),
    );
    expect(error).toBe(refusal);
});
