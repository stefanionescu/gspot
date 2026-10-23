import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/apply.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { PACKAGE_MANAGER_CASES } from '#tests/config/integration/samples.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';
import { INIT_FILES } from '#tests/config/commands/init/conflicting-config-files.ts';
import { spawnGspot, buildInitArguments, installGeneratedTools } from '#tests/setup/cli/commands.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir(INIT_FILES);

    commitAll(sandbox.path);
    const init = await spawnGspot(sandbox.path, buildInitArguments([]));
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await installGeneratedTools(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect((JSON.parse(applied.stdout) as DryRunJson).outdated).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});

test('install refuses an npm tool project edited to run scripts, before it contacts the registry', async () => {
    await using sandbox = await createNpmProject(...PACKAGE_MANAGER_CASES[0]);
    const { root, registry } = sandbox;
    const packageJsonPath = join(root, GSPOT_PATHS.npmProject);
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as object;
    await chmod(packageJsonPath, 0o644);
    const hasScript = JSON.stringify({ ...packageJson, scripts: { postinstall: 'exit 42' } });
    await writeFile(packageJsonPath, hasScript);
    const requests = registry.requests;
    const refused = await spawnGspot(root, ['install', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toStrictEqual({
        error: 'install',
        message: 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.',
    });
    expect(registry.requests).toBe(requests);
    expect(await readFile(packageJsonPath, 'utf8')).toBe(hasScript);
});

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %s)',
    async (hasCommits) => {
        await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

        runGitStep(sandbox.path, ['init', '-q']);
        if (hasCommits) commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n');
        runGitStep(sandbox.path, ['add', 'scripts/a.sh']);
        await writeFile(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n\n');
        await writeFile(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = runGitStep(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runGit(sandbox.path, ['rev-parse', '--verify', 'HEAD']);
        const preview = await spawnGspot(sandbox.path, [
            ...buildInitArguments([]),
            '--no-configurations',
            '--dry-run',
            '--json',
        ]);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const initialized = await spawnGspot(sandbox.path, [
            ...buildInitArguments([], { json: true }),
            '--no-configurations',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
        await installGeneratedTools(sandbox.path);
        const checked = await spawnGspot(sandbox.path, ['check', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'scripts/a.sh'), 'utf8')).toBe(CLEAN_BASH_SCRIPT + '\n\n');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('draft\n');
        expect(runGitStep(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
        expect(runGit(sandbox.path, ['rev-parse', '--verify', 'HEAD'])).toStrictEqual(head);
    },
);
