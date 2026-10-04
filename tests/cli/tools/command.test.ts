import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';

test('tool execution accepts literal arguments, stdin, and caller environment without policy', async () => {
    await using sandbox = await testdir();
    const result = await runTool(
        [
            process.execPath,
            '-e',
            'console.log(process.argv[1], process.env.NO_COLOR, process.env.FORCE_COLOR); console.log(await Bun.stdin.text());',
            'literal $(value)',
        ],
        { cwd: sandbox.path, env: { NO_COLOR: 'custom' }, stdin: 'input', timeoutSeconds: 2 },
    );
    expect(result).toMatchObject({ code: 0, stdout: 'literal $(value) custom 0\ninput\n', stderr: '', missing: false });
});

test('tool deadlines use seconds and cancellation remains distinct from a timeout', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '-e', 'setInterval(() => {}, 1000)'];
    const deadline = await runTool(command, { cwd: sandbox.path, timeoutSeconds: 0.1 });
    expect(deadline).toMatchObject({ isTimedOut: true, isCanceled: false, missing: false });
    expect(deadline.code).not.toBe(0);
    const canceled = await runTool(command, {
        cwd: sandbox.path,
        timeoutSeconds: 2,
        cancelSignal: AbortSignal.timeout(100),
    });
    expect(canceled).toMatchObject({ isTimedOut: false, isCanceled: true, missing: false });
    expect(canceled.code).not.toBe(0);
});

test('cancellation before launch leaves no tool side effect', async () => {
    await using sandbox = await testdir();
    const result = await runTool([process.execPath, '-e', 'await Bun.write("started", "side effect");'], {
        cwd: sandbox.path,
        cancelSignal: AbortSignal.abort(),
    });
    expect(result).toMatchObject({
        code: 1,
        stdout: '',
        stderr: 'The command was canceled.',
        isCanceled: true,
        duration: 0,
    });
    expect(existsSync(join(sandbox.path, 'started'))).toBe(false);
});
