import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';

test('a tool run turns CRLF into LF in both streams', async () => {
    await using sandbox = await testdir();
    const printed = String.raw`process.stdout.write('one\r\ntwo\r\n'); process.stderr.write('three\r\n');`;
    const result = await runTool([process.execPath, '-e', printed], { cwd: sandbox.path, timeoutSeconds: 2 });
    expect(result.stdout).toBe('one\ntwo\n');
    expect(result.stderr).toBe('three\n');
});

test('runTool passes literal arguments, stdin, and the caller environment', async () => {
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
