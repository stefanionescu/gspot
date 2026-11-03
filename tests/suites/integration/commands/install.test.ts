import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { INIT_FILES } from '#tests/config/setup/sandboxes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir(INIT_FILES);

    commitAll(sandbox.path);
    const init = await spawnGspot(sandbox.path, ['init']);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await applyThenInstall(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']);
    expect(parseCheckReport(applied).report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %s)',
    async (hasCommits) => {
        await using sandbox = await createGitSandbox({ 'plans.txt': 'committed\n' });

        if (hasCommits) commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'plans.txt'), 'staged\n');
        runGitStep(sandbox.path, ['add', 'plans.txt']);
        await writeFile(join(sandbox.path, 'plans.txt'), 'unstaged\n');
        await writeFile(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = runGitStep(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        const initialized = await spawnGspot(sandbox.path, ['init', '--json', '--no-configurations']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        await applyThenInstall(sandbox.path);
        const checked = await spawnGspot(sandbox.path, ['check', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'plans.txt'), 'utf8')).toBe('unstaged\n');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('draft\n');
        expect(runGitStep(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
        const after = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        expect({ code: after.code, stdout: after.stdout }).toStrictEqual({ code: head.code, stdout: head.stdout });
    },
);

test('a repeated npm install keeps the lockfile and the modules with the registry offline', async () => {
    await using sandbox = await createNpmProject('npm', 'package.json');
    const { root, registry } = sandbox;
    const first = await spawnGspot(root, ['install']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const lockfile = await readFile(join(root, GSPOT_FOLDER, 'package-lock.json'), 'utf8');
    const marker = join(root, GSPOT_PATHS.nodeModules, 'prettier/keep.txt');
    await writeFile(marker, 'installed modules');
    const requests = registry.requests.filter((request) => request !== 'GET /npm');
    for (const isOnline of [true, false]) {
        if (!isOnline) registry[Symbol.dispose]();
        const next = await spawnGspot(root, ['install', '--json']);
        expect(next.code, next.stdout + next.stderr).toBe(0);
        expect(JSON.parse(next.stdout)).toMatchObject({
            summary: 'No change: every tool is installed.',
            installed: [],
        });
        expect(await readFile(join(root, GSPOT_FOLDER, 'package-lock.json'), 'utf8')).toBe(lockfile);
        expect(
            registry.requests.filter((request) => request !== 'GET /npm'),
            next.stdout,
        ).toStrictEqual(requests);
        expect(await readFile(marker, 'utf8')).toBe('installed modules');
    }
});
