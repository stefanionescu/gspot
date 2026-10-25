import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { CLI_BIN } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { validateRuntimeVersion } from '#cli/system/runtime.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('an unsupported runtime honors JSON before loading commands', async () => {
    await using sandbox = await testdir();
    const message = validateRuntimeVersion({ node: '0.0.0' }, cliPackage.engines);
    const command = buildProgramCommand('processes/node-version', '0.0.0', CLI_BIN, 'check', '--json');
    const result = await runCommand(command, { cwd: sandbox.path });
    expect(result.code).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({ error: 'runtime', message });
});
