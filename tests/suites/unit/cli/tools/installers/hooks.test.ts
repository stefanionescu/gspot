import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { HOOKS_SETTINGS } from '#tests/config/hooks.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { createGitSandbox, createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';

import {
    HOOK_REPOSITORIES,
    STOCK_LFS_PRE_PUSH,
    HOOK_CONFIGURATION_CASES,
} from '#tests/config/tools/installers/installers.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks, gets the lines to add, and is ready only after both lines',
    async (provider) => {
        const { startProgram } = provider;
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

        const steps: (readonly string[])[] = [];
        const session = await openSession(sandbox.path);
        const { note: text } = await installHooks(session, steps);
        const command = startProgram === 'mise' ? 'mise exec -- gspot' : 'npm exec --no -- gspot';
        expect({ steps, text }).toStrictEqual({
            steps: [],
            text: `hooks already run from ${provider.location}; add these gspot lines to them:\n  pre-commit: ${command} check --staged --stage commit\n  pre-push: ${command} check --hook pre-push -- "$@"\n  commit-msg: ${command} check --hook commit-msg -- "$1"`,
        });
        expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);

        expect(await readHookStatus(session, session.repository)).toStrictEqual({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await writeFile(
            join(sandbox.path, first!.path),
            `${first!.content}\n${command} check --staged --stage commit\n`,
        );
        expect(await readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
        });
        await writeFile(
            join(sandbox.path, first!.path),
            `${first!.content}\n${command} check --staged --stage commit\n${command} check --hook pre-push\n${command} check --hook commit-msg\n`,
        );
        if (first!.path.endsWith('/pre-commit'))
            for (const hook of ['pre-push', 'commit-msg']) {
                const path = join(sandbox.path, dirname(first!.path), hook);
                await writeFile(path, `${command} check --hook ${hook}\n`);
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
        expect(await readHookStatus(session, session.repository).then(({ ready }) => ready)).toBe(false);
        await writeFile(join(sandbox.path, path), bothHooks);
        expect(await readHookStatus(session, session.repository)).toStrictEqual({
            ready: true,
            text: `run from ${path}`,
        });
    },
);

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });

    const steps: (readonly string[])[] = [];
    const session = await openSession(sandbox.path);
    expect(await installHooks(session, steps)).toHaveProperty('note', '');
    expect(steps).toStrictEqual([]);
    expect(await readHookStatus(session, session.repository)).toStrictEqual({ ready: true, text: 'none' });
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test('turning hooks off removes .gspot/hooks and leaves unsetting core.hooksPath to install', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const settings = buildSandboxSettings([], { tables: HOOKS_SETTINGS });
    await createFileTree(root, { 'gspot.toml': settings });
    runGitStep(sandbox.path, ['init', '-q']);
    expect(await runGspot(root, ['apply'])).toHaveProperty('code', 0);
    const ownPath = GSPOT_PATHS.hooks;
    runGitStep(root, ['config', 'core.hooksPath', ownPath]);
    expect(await readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const hook = join(root, `${GSPOT_PATHS.hooks}/pre-commit`);
    await writeFile(join(root, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const removed = await runGspot(root, ['apply']);
    expect(removed.code).toBe(0);
    expect(await isOnDisk(hook)).toBe(false);
    expect(await readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const removedSteps: (readonly string[])[] = [];
    const session = await openSession(root);
    await installHooks(session, removedSteps);
    expect(await readGitSetting(root, 'core.hooksPath')).toBeUndefined();
    runGitStep(root, ['config', 'core.hooksPath', '.githooks']);
    const steps: (readonly string[])[] = [];
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
    const steps: (readonly string[])[] = [];
    const session = await openSession(sandbox.path);
    expect(await installHooks(session, steps)).toHaveProperty('note', 'set core.hooksPath to .gspot/hooks');
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.hooks}/post-merge`), 'utf8')).toContain(
        'git lfs post-merge "$@"',
    );
    await writeFile(join(sandbox.path, '.git/hooks/post-merge'), '#!/bin/sh\ngit lfs post-merge "$@"\necho custom\n');
    await chmod(join(sandbox.path, '.git/hooks/post-merge'), 0o755);
    runGitStep(sandbox.path, ['config', '--unset', 'core.hooksPath']);
    const reinstalled = await installHooks(session, []);
    expect(reinstalled.note).toContain('hooks already run from .git/hooks');
});

test('a core.hooksPath that names the gspot hooks as an absolute, ./, or slash-ended path is installed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    const session = await openSession(sandbox.path);
    const root = session.repository.root;
    for (const hooksPath of [join(root, GSPOT_PATHS.hooks), `./${GSPOT_PATHS.hooks}`, `${GSPOT_PATHS.hooks}/`]) {
        runGitStep(root, ['config', 'core.hooksPath', hooksPath]);
        expect(await readHookStatus(session, session.repository), hooksPath).toStrictEqual({
            ready: true,
            text: 'installed',
        });
    }
});

test('hooks already set to .gspot/hooks need no command or note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    runGitStep(sandbox.path, ['config', 'core.hooksPath', GSPOT_PATHS.hooks]);
    const steps: (readonly string[])[] = [];
    expect(await installHooks(await openSession(sandbox.path), steps)).toHaveProperty('note', '');
    expect(steps).toStrictEqual([]);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
});

test('hook status ignores commented commands and commands in the wrong hook file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.githooks/pre-commit': '# gspot check --staged --stage commit\ngspot check --hook pre-push\n',
    });
    const session = await openSession(sandbox.path);
    expect(await readHookStatus(session, session.repository).then(({ ready }) => ready)).toBe(false);
    await writeFile(
        join(sandbox.path, '.githooks/pre-commit'),
        'gspot check --staged --stage commit\ngspot check --hook pre-push\n',
    );
    expect(await readHookStatus(session, session.repository).then(({ ready }) => ready)).toBe(false);
    await writeFile(join(sandbox.path, '.githooks/pre-push'), 'gspot check --hook pre-push\n');
    expect(await readHookStatus(session, session.repository).then(({ ready }) => ready)).toBe(false);
    await writeFile(join(sandbox.path, '.githooks/commit-msg'), 'gspot check --hook commit-msg\n');
    expect(await readHookStatus(session, session.repository).then(({ ready }) => ready)).toBe(true);
});

test('a linked executable Git hook is retained by install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'authored-hook': '#!/bin/sh\nexit 0\n',
    });
    await chmod(join(sandbox.path, 'authored-hook'), 0o755);
    await symlink('../../authored-hook', join(sandbox.path, '.git/hooks/pre-commit'));
    const session = await openSession(sandbox.path);
    const steps: (readonly string[])[] = [];
    expect(await installHooks(session, steps)).toHaveProperty(
        'note',
        expect.stringContaining('hooks already run from .git/hooks'),
    );
    expect(steps).toStrictEqual([]);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});
