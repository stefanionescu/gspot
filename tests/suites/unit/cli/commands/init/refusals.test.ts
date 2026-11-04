import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { readTree } from '#tests/setup/system/files.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import { PRESERVE_SOURCE, UNCOMMITTED_FORMAT_CASES } from '#tests/config/generation/plan.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'bassh', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringMatching(/\bbash\b/u) as string,
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([
    { flags: ['--configurations', 'bash', '--no-configurations'] },
    { flags: ['--no-configurations', '--configurations', 'bash'] },
])('init $flags refuses the two selections and writes nothing', async ({ flags }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', ...flags, '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

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

test('init without a terminal writes the plan and preserves authored files', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'control.txt': PRESERVE_SOURCE });

    const accepted = await runGspot(sandbox.path, ['init']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.stderr).toBe('');
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe(PRESERVE_SOURCE);
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
