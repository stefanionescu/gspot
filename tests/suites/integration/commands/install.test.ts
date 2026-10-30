import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { INIT_FILES } from '#tests/config/init.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/apply.ts';
import { TOOL_PROJECTS_MESSAGE } from '#tests/config/messages.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import type { InstallCommandJson } from '#cli/types/commands/install.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, applyThenInstall } from '#tests/setup/cli/commands.ts';
import { PACKAGE_MANAGER_CASES } from '#tests/config/integration/package-managers.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir(INIT_FILES);

    commitAll(sandbox.path);
    const init = await spawnGspot(sandbox.path, ['init', '--yes']);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await applyThenInstall(sandbox.path);
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
    const scriptedPackage = JSON.stringify({ ...packageJson, scripts: { postinstall: 'exit 42' } });
    await writeFile(packageJsonPath, scriptedPackage);
    const requests = registry.requests;
    const refused = await spawnGspot(root, ['install', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toStrictEqual({
        error: 'install',
        message: TOOL_PROJECTS_MESSAGE,
    });
    expect(registry.requests).toBe(requests);
    expect(await readFile(packageJsonPath, 'utf8')).toBe(scriptedPackage);
});

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %s)',
    async (hasCommits) => {
        await using sandbox = await createGitSandbox({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

        if (hasCommits) commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n');
        runGitStep(sandbox.path, ['add', 'scripts/a.sh']);
        await writeFile(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n\n');
        await writeFile(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = runGitStep(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runCommandBlocking(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        const initialized = await spawnGspot(sandbox.path, ['init', '--yes', '--json', '--no-configurations']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
        await applyThenInstall(sandbox.path);
        const checked = await spawnGspot(sandbox.path, ['check', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'scripts/a.sh'), 'utf8')).toBe(CLEAN_BASH_SCRIPT + '\n\n');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('draft\n');
        expect(runGitStep(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
        const after = runCommandBlocking(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        expect({ code: after.code, stdout: after.stdout }).toStrictEqual({ code: head.code, stdout: head.stdout });
    },
);

test('a repeated npm install skips npm ci and keeps modules with the registry offline', async () => {
    await using sandbox = await createNpmProject('npm', 'package.json');
    const { root, registry } = sandbox;
    const first = await spawnGspot(root, ['install']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const record = await readFile(join(root, GSPOT_PATHS.installRecord), 'utf8');
    const marker = join(root, GSPOT_PATHS.nodeModules, 'keep.txt');
    await writeFile(marker, 'installed modules');
    const requests = registry.requests;
    for (const online of [true, false]) {
        if (!online) registry[Symbol.dispose]();
        const next = await spawnGspot(root, ['install', '--json']);
        expect(next.code, next.stdout + next.stderr).toBe(0);
        const result = JSON.parse(next.stdout) as InstallCommandJson;
        expect(result.steps.filter((step) => step.includes('ci'))).toStrictEqual([]);
        expect(registry.requests).toBe(requests);
        expect(await readFile(join(root, GSPOT_PATHS.installRecord), 'utf8')).toBe(record);
        expect(await readFile(marker, 'utf8')).toBe('installed modules');
    }
});
