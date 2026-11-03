import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { PACKAGE_JSON_ERROR } from '#tests/config/setup/programs.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import { PRESERVE_SOURCE, UNCOMMITTED_FORMAT_CASES } from '#tests/config/generation/plan.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'bassh']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toBe(
        'There is no configuration called bassh. Did you mean bash? See https://generativespotting.com/reference/configurations/ for the available configurations.\n',
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([
    ['--configurations', 'bash', '--no-configurations'],
    ['--no-configurations', '--configurations', 'bash'],
])('init %s %s %s refuses the two selections and writes nothing', async (...flags) => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', ...flags]);
    expect(result).toStrictEqual({
        code: 2,
        stdout: '',
        stderr: '--configurations cannot run with --no-configurations. Give the names, or select none.\n',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init refuses an unreadable package.json before writing', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{', 'source.ts': 'export {};\n' });

    await assertRefusalWithoutWrites(sandbox.path, ['init'], {
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
    await assertRefusalWithoutWrites(sandbox.path, ['init'], {
        error: 'arguments',
        message:
            'This repository already has a gspot.toml. Run gspot doctor to inspect its setup, and gspot check --only gspot/detected-configurations for the gspot add line of each newly detected configuration.',
    });
});

test('init without a terminal writes the plan and preserves authored files', async () => {
    await using sandbox = await createGitSandbox({ 'control.txt': PRESERVE_SOURCE });

    const accepted = await runGspot(sandbox.path, ['init']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.stderr).toBe('');
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe(PRESERVE_SOURCE);
});

test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using sandbox = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, GSPOT_FOLDER));
    const refused = await runGspot(project, ['init', '--configurations', 'bash']);
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
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'javascript']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe(
        `init replaces ${path}, and Git does not hold it unchanged at HEAD. Commit it or move it away, then run gspot init again.\n`,
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
