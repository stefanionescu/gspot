import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/setup/install.ts';
import { join, dirname, delimiter } from 'node:path';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';

test('a check whose tool is not installed fails with the pinned version and the install command', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        '.gitignore': 'home/\nbin/\n',
        home: {},
        bin: {},
    });
    commitAll(sandbox.path);
    const bin = join(sandbox.path, 'bin');
    const gitPath = Bun.which('git');
    expect(gitPath).not.toBeNull();
    await symlink(process.execPath, join(bin, isWindows ? 'bun.exe' : 'bun'));
    // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
    if (!isWindows) await symlink(gitPath!, join(bin, 'git'));
    const path = isWindows ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash']), {
        ...environment,
        PATH: toolsPath(),
    });
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout + initialized.stderr).toContain('Run gspot install');
    const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
    expect(check.code).toBe(2);
    expect(check.stdout).toContain('missing');
    expect(check.stdout).toContain(
        `shellcheck ${String(getToolDeclaration([...readManifests().values()], 'shellcheck').version)} is not installed`,
    );
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const builtIn = await spawnGspot(sandbox.path, ['check', '--only', 'bash/function-size', '--json'], environment);
    expect(builtIn.code, builtIn.stdout + builtIn.stderr).toBe(0);
    expect((JSON.parse(builtIn.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/function-size', status: 'passed', findings: [] },
    ]);
    const available = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
    expect(available.code, available.stdout + available.stderr).toBe(0);
    expect((JSON.parse(available.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', findings: [] },
    ]);
});
