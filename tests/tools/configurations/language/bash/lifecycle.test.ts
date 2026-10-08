// A missing shell tool reports its pinned version and install hint; the available tool checks the same script.
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { configurationManifests } from '#cli/configurations/public.ts';

test('a missing tool fails with the install hint', async () => {
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
    await symlink(process.execPath, join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'));
    // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
    if (process.platform !== 'win32') await symlink(gitPath!, join(bin, 'git'));
    const path = process.platform === 'win32' ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(
        sandbox.path,
        ['init', '--yes', '--configurations', 'bash', '--no-runner', '--no-ci', '--no-agent-rules', '--no-install'],
        { ...environment, PATH: buildToolsPath([]) },
    );
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
    const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
    expect(check.code).toBe(2);
    expect(check.stdout).toContain('missing');
    expect(check.stdout).toContain(
        `shellcheck ${String(toolPin([...configurationManifests().values()], 'shellcheck').version)} is not installed`,
    );
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const missing = await spawnGspot(sandbox.path, ['check', '--only', 'bash/function-size'], environment);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toContain('missing');
    expect(missing.stdout).toContain('Run: gspot install');
    const available = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
    expect(available.code, available.stdout + available.stderr).toBe(0);
    expect((JSON.parse(available.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', findings: [] },
    ]);
});
