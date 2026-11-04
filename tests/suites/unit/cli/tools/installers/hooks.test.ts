import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { rm, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { createGitSandbox, createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';
import { HOOK_REPOSITORIES, STOCK_LFS_PRE_PUSH, HOOK_CONFIGURATION_CASES } from '#tests/config/tools/installers.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks, gets the lines to add, and is ready only after both lines',
    async (provider) => {
        await using sandbox = await createGitSandbox({});
        const { files, setting, gitHook } = provider;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                tables: HOOKS_SETTINGS,
            }),
            ...files,
        });
        if (setting !== undefined) runGitStep(sandbox.path, [...setting]);
        if (gitHook) {
            await writeFile(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
            await chmod(join(sandbox.path, '.git/hooks/pre-commit'), 0o755);
        }
        const before = await readGitSetting(sandbox.path, 'core.hooksPath');
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await readFile(join(sandbox.path, path), 'utf8') })),
        );
        await applyGeneratedFiles(sandbox.path);

        const steps: Array<readonly string[]> = [];
        const session = await openSession(sandbox.path);
        const { note: text } = await installHooks(session, steps);
        expect({ steps, text }).toStrictEqual({
            steps: [],
            text: `hooks already run from ${provider.location}; add these gspot lines to them:\n  pre-commit: .gspot/hooks/pre-commit "$@"\n  pre-push: .gspot/hooks/pre-push "$@"\n  commit-msg: .gspot/hooks/commit-msg "$@"`,
        });
        expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);

        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await writeFile(join(sandbox.path, first!.path), `${first!.content}\n.gspot/hooks/pre-commit\n`);
        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
        });
        await writeFile(
            join(sandbox.path, first!.path),
            `${first!.content}\n.gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n.gspot/hooks/commit-msg\n`,
        );
        if (first!.path.endsWith('/pre-commit'))
            for (const hook of ['pre-push', 'commit-msg']) {
                const path = join(sandbox.path, dirname(first!.path), hook);
                await writeFile(path, `.gspot/hooks/${hook}\n`);
                await chmod(path, 0o755);
            }
        expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: true });
    },
);

test.each([...HOOK_CONFIGURATION_CASES])(
    'hooks in $path are ready only after both commands',
    async ({ path, oneHook, bothHooks }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
            [path]: oneHook,
        });
        const session = await openSession(sandbox.path);
        expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
        await writeFile(join(sandbox.path, path), bothHooks);
        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: true,
            text: `run from ${path}`,
        });
    },
);

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });

    const steps: Array<readonly string[]> = [];
    const session = await openSession(sandbox.path);
    expect(await installHooks(session, steps)).toHaveProperty('note', '');
    expect(steps).toStrictEqual([]);
    expect(await readHookStatus(session, session.repository)).toStrictEqual({ ready: true, text: 'none' });
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test('turning hooks off removes .gspot/hooks and unsets core.hooksPath at once', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const settings = buildSandboxSettings([], { tables: HOOKS_SETTINGS });
    await createFileTree(root, { 'gspot.toml': settings });
    runGitStep(sandbox.path, ['init', '-q']);
    await applyGeneratedFiles(root);
    const ownPath = GSPOT_PATHS.hooks;
    runGitStep(root, ['config', 'core.hooksPath', ownPath]);
    expect(await readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const hook = join(root, `${GSPOT_PATHS.hooks}/pre-commit`);
    await writeFile(join(root, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    await applyGeneratedFiles(root);
    expect(existsSync(hook)).toBe(false);
    expect(await readGitSetting(root, 'core.hooksPath')).toBeUndefined();
    const session = await openSession(root);
    runGitStep(root, ['config', 'core.hooksPath', '.githooks']);
    const steps: Array<readonly string[]> = [];
    expect(await installHooks(session, steps)).toHaveProperty('note', '');
    expect(await readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});

test('the hooks that git lfs install wrote are not other hooks, so install points Git at the gspot hooks', async () => {
    await using sandbox = await createLfsRepository();
    await writeFile(join(sandbox.path, '.git/hooks/pre-push'), STOCK_LFS_PRE_PUSH);
    await writeFile(
        join(sandbox.path, '.git/hooks/post-merge'),
        STOCK_LFS_PRE_PUSH.replaceAll('pre-push', 'post-merge'),
    );
    await applyGeneratedFiles(sandbox.path);
    const steps: Array<readonly string[]> = [];
    const session = await openSession(sandbox.path);
    await installHooks(session, steps);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.hooks}/post-merge`), 'utf8')).toContain(
        'git lfs post-merge "$@"',
    );
    await writeFile(join(sandbox.path, '.git/hooks/post-merge'), '#!/bin/sh\ngit lfs post-merge "$@"\necho custom\n');
    await chmod(join(sandbox.path, '.git/hooks/post-merge'), 0o755);
    runGitStep(sandbox.path, ['config', '--unset', 'core.hooksPath']);
    const reinstalled = await installHooks(session, []);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
    expect(reinstalled.note).toContain('.git/hooks');
});

test('a core.hooksPath that names the gspot hooks as an absolute, ./, or slash-ended path is installed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const root = session.repository.root;
    for (const hooksPath of [join(root, GSPOT_PATHS.hooks), `./${GSPOT_PATHS.hooks}`, `${GSPOT_PATHS.hooks}/`]) {
        runGitStep(root, ['config', 'core.hooksPath', hooksPath]);
        expect(await readHookStatus(session, session.repository), hooksPath).toMatchObject({
            ready: true,
            text: 'installed',
        });
    }
});

test('the gspot hooks are not ready while a hook file is missing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    await applyGeneratedFiles(sandbox.path);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', GSPOT_PATHS.hooks]);
    await rm(join(sandbox.path, GSPOT_PATHS.hooks, 'pre-push'));
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository)).toStrictEqual({
        ready: false,
        tool: 'gspot',
        lines: ['.gspot/hooks/pre-push is missing, so Git skips the pre-push checks. Run gspot install.'],
        text: 'not ready; .gspot/hooks/pre-push is missing, so Git skips the pre-push checks. Run gspot install.',
    });
});

test.skipIf(isWindows)('the gspot hooks are not ready while a hook file is not executable', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    await applyGeneratedFiles(sandbox.path);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', GSPOT_PATHS.hooks]);
    await chmod(join(sandbox.path, GSPOT_PATHS.hooks, 'pre-commit'), 0o644);
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository)).toMatchObject({
        ready: false,
        lines: ['.gspot/hooks/pre-commit is not executable, so Git skips the pre-commit checks. Run gspot install.'],
    });
});

test('hooks already set to .gspot/hooks need no command or note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    runGitStep(sandbox.path, ['config', 'core.hooksPath', GSPOT_PATHS.hooks]);
    const steps: Array<readonly string[]> = [];
    expect(await installHooks(await openSession(sandbox.path), steps)).toHaveProperty('note', '');
    expect(steps).toStrictEqual([]);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
});

test('hook status ignores commented commands and commands in the wrong hook file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.githooks/pre-commit': '# .gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n',
    });
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/pre-commit'), '.gspot/hooks/pre-commit\n.gspot/hooks/pre-push\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/pre-push'), '.gspot/hooks/pre-push\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: false });
    await writeFile(join(sandbox.path, '.githooks/commit-msg'), '.gspot/hooks/commit-msg\n');
    expect(await readHookStatus(session, session.repository)).toMatchObject({ ready: true });
});

test('a linked executable Git hook is retained by install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'authored-hook': '#!/bin/sh\nexit 0\n',
    });
    await chmod(join(sandbox.path, 'authored-hook'), 0o755);
    await symlink('../../authored-hook', join(sandbox.path, '.git/hooks/pre-commit'));
    const session = await openSession(sandbox.path);
    const steps: Array<readonly string[]> = [];
    expect(await installHooks(session, steps)).toHaveProperty(
        'note',
        expect.stringContaining('hooks already run from .git/hooks'),
    );
    expect(steps).toStrictEqual([]);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});
