import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { FAILED_NPM_VERSION } from '#tests/config/commands/install.ts';

test('apply starts no npm, and install reports a failed npm version lookup in text and JSON', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const run = processes.spawnProcessBlocking;
    using boundary = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        return command[0] === 'npm' && command[1] === '--version'
            ? buildProcessResult(FAILED_NPM_VERSION)
            : run(command, options);
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(boundary).not.toHaveBeenCalledWith(['npm', '--version'], expect.anything());
    const before = await readTree(sandbox.path);
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Cannot determine the npm version for the tool project.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, ['install', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'install',
        message: 'Cannot determine the npm version for the tool project.',
    });
    expect(boundary).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({ cwd: sandbox.path }));
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
