import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { PACKAGE_JSON_ERROR } from '#tests/config/paths.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PRESERVE_SOURCE } from '#tests/config/commands/contents.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { UNCOMMITTED_FORMAT_CASES } from '#tests/config/commands/init/refusals.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'bassh']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toBe(
        'There is no configuration called bassh. Did you mean bash? See https://generativespotting.com/reference/configurations/ for the available configurations.\n',
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init refuses an unreadable package.json before writing', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{', 'source.ts': 'export {};\n' });

    await assertRefusalWithoutWrites(sandbox.path, ['init', '--yes'], {
        error: 'parse',
        message: PACKAGE_JSON_ERROR,
    });
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    await assertRefusalWithoutWrites(sandbox.path, ['init', '--yes'], {
        error: 'settings',
        message:
            'This repository already has a gspot.toml. Run gspot doctor to inspect its setup; it prints the gspot add line for newly detected configurations.',
    });
});

test('init --json without --yes names --yes before reading the repository', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: '--json needs --yes, because gspot cannot ask while it prints JSON.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init without a terminal names --yes once and writes only after --yes', async () => {
    await using sandbox = await createGitSandbox({ 'control.txt': PRESERVE_SOURCE });

    const commandArguments = ['init', '--yes'].filter((argument) => argument !== '--yes');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe(PRESERVE_SOURCE);
});

test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using sandbox = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, GSPOT_FOLDER));
    const refused = await runGspot(project, ['init', '--yes', '--configurations', 'bash']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe(
        `A parent of ${GSPOT_FOLDER}/.gitignore is a link or is not a folder. Choose a folder without links.\n`,
    );
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
});

test.each(UNCOMMITTED_FORMAT_CASES)('init refuses to replace $path absent from HEAD: $state', async (variant) => {
    const { path } = variant;
    await using sandbox = await testdir({ 'source.js': 'export const count = 1;\n' });
    await prepareUncommittedFormat(sandbox.path, variant);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'javascript']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe(
        `init replaces ${path}, and Git does not hold them unchanged at HEAD. Commit them or move them away, then run gspot init again.\n`,
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

async function prepareUncommittedFormat(
    root: string,
    scenario: (typeof UNCOMMITTED_FORMAT_CASES)[number],
): Promise<void> {
    const { state, path, original, changed } = scenario;
    if (state === 'unborn Git') runGitStep(root, ['init', '-q']);
    else if (state === 'untracked') commitAll(root);
    await writeFile(join(root, path), original);
    if (!(state === 'staged changes' || state === 'unstaged changes')) {
        return;
    }

    commitAll(root);
    await writeFile(join(root, path), changed);
    if (state === 'staged changes') runGitStep(root, ['add', '--', path]);
}
