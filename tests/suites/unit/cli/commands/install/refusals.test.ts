import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('install refuses a gspot.toml that links outside the repository and writes nothing', async () => {
    const outside = 'configurations = []\n';
    await using sandbox = await testdir({ 'project/.gspot/configurations/.keep': '', outside });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    await symlink(join(sandbox.path, 'outside'), join(project, 'gspot.toml'));
    const refused = await runGspot(project, ['install', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
});
