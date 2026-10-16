import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';

test("a tool's output reaches its check with LF line endings when the tool prints CRLF", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildSettingsText(['bash']) });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'bash/shfmt');
    const printed = String.raw`process.stdout.write('one\r\ntwo\r\n'); process.stderr.write('three\r\n');`;
    const result = await runCheckTool(input, [process.execPath, '-e', printed], { cwd: sandbox.path });
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
