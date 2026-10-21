import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { INIT_FILES } from '#tests/data/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { PACKAGE_MANAGER_ROWS } from '#tests/data/install/npm-tool-project.ts';
import { buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';
import { createPackageManagerSandbox } from '#tests/setup/package-manager-sandboxes.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INIT_FILES);
    commitAll(sandbox.path);
    const environment = { PATH: buildSandboxPath() };
    const init = await spawnGspot(sandbox.path, buildInitArguments([]), environment);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect((JSON.parse(applied.stdout) as DryRunJson).stale).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});

test('install refuses an npm tool project edited to run scripts, before it contacts the registry', async () => {
    await using sandbox = await createPackageManagerSandbox(...PACKAGE_MANAGER_ROWS[0]);
    const { root, registry } = sandbox;
    const manifestPath = join(root, '.gspot/package.json');
    const manifest = await readFile(manifestPath);
    await chmod(manifestPath, 0o644);
    const hasScript = JSON.stringify({
        ...JSON.parse(Buffer.from(manifest).toString('utf8')),
        scripts: { postinstall: 'exit 42' },
    });
    await writeFile(manifestPath, hasScript);
    const requests = registry.requests;
    const refused = await spawnGspot(root, ['install', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toContain('Run gspot apply first');
    expect(registry.requests).toBe(requests);
    expect(await readFile(manifestPath, 'utf8')).toBe(hasScript);
});

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %s)',
    async (hasCommits) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
        readGitOutput(sandbox.path, ['init', '-q']);
        if (hasCommits) commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n');
        readGitOutput(sandbox.path, ['add', 'scripts/a.sh']);
        await Bun.write(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n\n');
        await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = readGitOutput(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runGit(sandbox.path, ['rev-parse', '--verify', 'HEAD']);
        const environment = { PATH: buildSandboxPath() };
        const preview = await spawnGspot(
            sandbox.path,
            [...buildInitArguments([]), '--no-configurations', '--dry-run', '--json'],
            environment,
        );
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const initialized = await spawnGspot(
            sandbox.path,
            [...buildInitArguments([], { json: true }), '--no-configurations'],
            environment,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
        await installToolProjects(sandbox.path);
        const checked = await spawnGspot(sandbox.path, ['check', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'scripts/a.sh')).text()).toBe(CLEAN_BASH_SCRIPT + '\n\n');
        expect(await Bun.file(join(sandbox.path, 'notes.txt')).text()).toBe('draft\n');
        expect(readGitOutput(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
        expect(runGit(sandbox.path, ['rev-parse', '--verify', 'HEAD'])).toStrictEqual(head);
    },
);
