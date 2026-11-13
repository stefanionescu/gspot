import { readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/system.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const UNCOMMITTED_FORMAT_CASES = ['unborn Git', 'untracked', 'staged changes', 'unstaged changes'].map((state) => ({
    path: '.prettierrc',
    original: '{"printWidth": 100}\n',
    changed: '{"printWidth": 90}\n',
    state,
}));

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

test('init refuses an unreadable package.json before writing', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'package.json': '{', 'source.ts': 'export {};\n' });

    await assertRefusalWithoutWrites(sandbox.path, ['init'], 'parse');
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    await assertRefusalWithoutWrites(sandbox.path, ['init'], 'arguments');
});

test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, GSPOT_FOLDER));
    const refused = await runGspot(project, ['init', '--configurations', 'bash', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
});

test.each(UNCOMMITTED_FORMAT_CASES)('init refuses to replace $path absent from HEAD: $state', async (variant) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const { path } = variant;
    await using sandbox = await testdir({ 'source.js': 'export const count = 1;\n' });
    await prepareUncommittedFormat(sandbox.path, variant);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'javascript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining(path) as string,
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
