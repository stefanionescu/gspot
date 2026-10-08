// Replay the Python tutorial scaffold, initialization, source finding, and correction through native tools.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { environmentVariables } from '#cli/platform/environment.ts';
import { initRepository, buildSandboxPath } from '#tests/harness/install.ts';
import { INVALID_SOURCE } from '#tests/config/tools/commands/python-quickstart.ts';

test('the Python quickstart reports its source defect and accepts the restored source', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'orders-python');
    await mkdir(root);
    const environment = { PATH: buildSandboxPath(['ruff']) };
    const scaffold = await runTestCommand(['uv', 'init', '--lib'], {
        cwd: root,
        env: { ...environmentVariables(), ...environment },
    });
    expect(scaffold.code, scaffold.stdout + scaffold.stderr).toBe(0);
    commitAll(root);
    await initRepository(root, ['init', '--yes', '--configurations', 'python'], environment);
    const source = join(root, 'src/orders_python/__init__.py');
    const original = await readFile(source, 'utf8');
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
    await writeFile(source, INVALID_SOURCE);
    const rejected = await spawnGspot(root, ['check', '--only', 'python/ruff'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout).toContain(
        'src/orders_python/__init__.py:3:1  invalid-syntax  unexpected EOF while parsing',
    );
    expect(rejected.stdout).toContain('invalid-syntax');
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', 'src/orders_python/__init__.py']);
    expect(await readFile(source, 'utf8')).toBe(original);
    const corrected = await spawnGspot(root, ['check', '--only', 'python/ruff'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
