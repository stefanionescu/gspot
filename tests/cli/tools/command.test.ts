import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/contracts.ts';

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

test('tool deadlines convert seconds to a native timeout', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '-e', 'setInterval(() => {}, 1000)'];
    const deadline = await runTool(command, { cwd: sandbox.path, timeoutSeconds: 0.1 });
    expect(deadline).toMatchObject({ isTimedOut: true, isCanceled: false, missing: false });
    expect(deadline.code).not.toBe(0);
});
