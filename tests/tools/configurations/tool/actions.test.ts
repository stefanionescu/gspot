// Sandbox for the actions configuration: a workflow with an unknown expression context and one open to template injection.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { ACTIONS_INIT } from '#tests/config/tools/configurations/tool/actions.ts';

test('the actions configuration: GitHub initialization writes a workflow accepted by actionlint', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Workflow test\n' });
    commitAll(sandbox.path);
    const environment = { PATH: buildToolsPath(['actionlint']) };
    await initRepository(sandbox.path, [...ACTIONS_INIT, '--ci', 'github', '--no-hooks'], environment);
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.github/workflows/gspot.yml')).exists()).toBe(true);
    const result = await runTestCommand(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
        cwd: sandbox.path,
        env: environment,
    });
    expect(result.code, result.stderr + result.stdout).toBe(0);
});
