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

test('a tool run keeps literal arguments, stdin, and the caller environment, and turns color off', async () => {
    await using sandbox = await testdir();
    const result = await runTool(
        buildProgramCommand(
            'processes/call',
            '--environment',
            'NO_COLOR',
            '--environment',
            'FORCE_COLOR',
            '--stdin',
            '--',
            'literal $(value)',
        ),
        { cwd: sandbox.path, env: { NO_COLOR: 'custom' }, stdin: 'input', timeoutSeconds: 2 },
    );
    expect({ code: result.code, stderr: result.stderr, missing: result.missing }).toStrictEqual({
        code: 0,
        stderr: '',
        missing: false,
    });
    expect(JSON.parse(result.stdout)).toStrictEqual({
        arguments: ['literal $(value)'],
        environment: { NO_COLOR: 'custom', FORCE_COLOR: '0' },
        cwd: sandbox.path,
        stdin: 'input',
    });
});
