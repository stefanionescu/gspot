import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a tool run turns CRLF into LF in both streams', async () => {
    await using sandbox = await testdir();
    const command = buildProgramCommand('fakes/tool', '--stdout', 'one\r\ntwo\r\n', '--stderr', 'three\r\n');
    const result = await runTool(command, { cwd: sandbox.path, timeoutSeconds: 2 });
    expect(result.stdout).toBe('one\ntwo\n');
    expect(result.stderr).toBe('three\n');
});

test('a tool run turns color off and keeps a color setting of the caller', async () => {
    await using sandbox = await testdir();
    const result = await runTool(
        buildProgramCommand('fakes/tool', '--record', '-', '--environment', 'NO_COLOR', '--environment', 'FORCE_COLOR'),
        { cwd: sandbox.path, env: { NO_COLOR: 'custom' }, timeoutSeconds: 2 },
    );
    expect(JSON.parse(result.stdout)).toMatchObject({ environment: { NO_COLOR: 'custom', FORCE_COLOR: '0' } });
});
