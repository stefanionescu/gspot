import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand, runCommand } from '#tests/setup/system/processes.ts';

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %p)',
    async (hasCommits) => {
        await using sandbox = await createGitSandbox({ 'plans.txt': 'committed\n' });

        if (hasCommits) commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'plans.txt'), 'staged\n');
        runGitStep(sandbox.path, ['add', 'plans.txt']);
        await writeFile(join(sandbox.path, 'plans.txt'), 'unstaged\n');
        await writeFile(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = runGitStep(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        const initialized = await spawnGspot(sandbox.path, ['init', '--json', '--configurations', 'gspot']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
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
    await using sandbox = await createNpmProject('npm');
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
        expect(JSON.parse(next.stdout)).toMatchObject({ installed: [], written: [], deleted: [], updated: [] });
        expect(await readFile(join(root, GSPOT_FOLDER, 'package-lock.json'), 'utf8')).toBe(lockfile);
        expect(
            registry.requests.filter((request) => request !== 'GET /npm'),
            next.stdout,
        ).toStrictEqual(requests);
        expect(await readFile(marker, 'utf8')).toBe('installed modules');
    }
});

test('a repeated install reports No change while a uv-locked project matches its lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml':
            '[project]\nname = "example"\nversion = "1.0.0"\nrequires-python = ">=3.10"\ndependencies = []\n',
        'main.py': 'VALUE = 1\n',
    });
    const locked = await runCommand(['uv', 'lock'], { cwd: sandbox.path });
    expect(locked.code, locked.stdout + locked.stderr).toBe(0);
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const repeated = await spawnGspot(sandbox.path, ['install', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout)).toMatchObject({ installed: [], written: [], deleted: [], updated: [] });
});
