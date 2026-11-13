import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { streamProcess } from '#cli/system/processes/run.ts';
import { CHILD_TIMEOUT_SECONDS } from '#tests/config/setup/programs.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { waitForExit } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('stream reading keeps raw bytes and the error output', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('fakes/tool', '--stdout-hex', '00ff000a', '--stderr', 'diagnostic\n');
    const bytes: Buffer[] = [];
    const result = await streamProcess(
        command,
        {
            cwd: sandbox.path,
            timeoutSeconds: CHILD_TIMEOUT_SECONDS,
        },
        async (chunks) => {
            for await (const chunk of chunks) bytes.push(chunk);
        },
    );
    expect(Buffer.concat(bytes)).toStrictEqual(Buffer.from([0, 255, 0, 10]));
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: 'diagnostic\n', end: 'exited' });
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
                timeoutSeconds: CHILD_TIMEOUT_SECONDS,
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
                timeoutSeconds: CHILD_TIMEOUT_SECONDS,
            },
            async (chunks) => {
                for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
                throw refusal;
            },
        ),
    );
    expect(error).toBe(refusal);
});
