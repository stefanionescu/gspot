// Installed hooks run staged checks in both the current repository and a fresh clone.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { git, commitAll } from '#tests/harness/git.ts';
import { buildSandboxPath } from '#tests/harness/install.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { spawnGspot, checkReport } from '#tests/harness/gspot.ts';

// A fresh clone installs immutable tools and rejects then accepts a real staged commit.
async function expectCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await testdir();
    const clone = join(cloneRoot.path, 'clone');
    const cloned = git(source, ['clone', '--quiet', '--no-local', source, clone]);
    expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
    const uninstalled = await checkReport(clone, ['check', '--only', 'bash/shellcheck', '--json']);
    expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
    expect(uninstalled.report).toMatchObject({
        stage: 'all',
        checks: [{ check: 'bash/shellcheck', scope: '', status: 'passed', fileCount: 2, findings: [] }],
        exitCode: 0,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        const installation = await spawnGspot(clone, ['install']);
        expect(installation.code, installation.stdout + installation.stderr).toBe(0);
        const status = git(clone, ['status', '--porcelain']);
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
    }
    const ready = await spawnGspot(clone, ['check', '--only', 'bash/shellcheck']);
    expect(ready.code, ready.stdout + ready.stderr).toBe(0);
    await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const rejected = git(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
    expect(rejected.code).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain('SC2086');
    await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
    expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const accepted = git(clone, ['commit', '-qm', 'Quote shell input'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
}

test('installed and freshly cloned repositories enforce staged findings through real commits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, [
        'init',
        '--yes',
        '--configurations',
        'bash',
        '--no-runner',
        '--no-ci',
        '--no-agent-rules',
        '--no-install',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const environment = {
        PATH: buildSandboxPath([]),
        NO_COLOR: '1',
    };
    const commit = git(sandbox.path, ['commit', '-qm', 'bad'], environment);
    expect(commit.code).not.toBe(0);
    expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
    await Bun.write(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = git(sandbox.path, ['commit', '-qm', 'Correct shell input'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await expectCloneHooks(sandbox.path, environment);
});
