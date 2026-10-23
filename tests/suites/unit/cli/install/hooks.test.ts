import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/cli.ts';
import type { DryRunJson } from '#cli/types/commands/apply.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { installHooks, readHookStatus } from '#cli/install/hooks.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';

import {
    HOOK_REPOSITORIES,
    STOCK_LFS_PRE_PUSH,
    buildHookInstructions,
    HOOK_CONFIGURATION_CASES,
} from '#tests/config/install/hooks.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks, gets the lines to add, and is ready only after both lines',
    async (provider) => {
        const { startProgram } = provider;
        await using sandbox = await testdir();
        const { files, setting, gitHook } = provider;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                tables: HOOKS_SETTINGS,
            }),
            ...files,
        });
        runGitStep(sandbox.path, ['init', '-q']);
        if (setting !== undefined) runGitStep(sandbox.path, [...setting]);
        if (gitHook) await writeFile(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
        const before = readGitSetting(sandbox.path, 'core.hooksPath');
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await readFile(join(sandbox.path, path), 'utf8') })),
        );
        await applyGeneratedFiles(sandbox.path);

        const steps: (readonly string[])[] = [];
        const session = await openSession(sandbox.path);
        const text = installHooks(session, steps);
        const command = startProgram === 'mise' ? 'mise exec -- gspot' : 'npm exec --no -- gspot';
        expect({ steps, text }).toStrictEqual({ steps: [], text: buildHookInstructions(provider.location, command) });
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);

        expect(readHookStatus(session, session.repository)).toStrictEqual({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await writeFile(join(sandbox.path, first!.path), `${first!.content}\n${command} check --hook pre-commit\n`);
        expect(readHookStatus(session, session.repository)).toMatchObject({
            ready: false,
        });
        await writeFile(
            join(sandbox.path, first!.path),
            `${first!.content}\n${command} check --hook pre-commit\n${command} check --hook pre-push\n`,
        );
        expect(readHookStatus(session, session.repository)).toMatchObject({ ready: true });
    },
);

test.each([...HOOK_CONFIGURATION_CASES])(
    'hooks in $path are ready only after both commands',
    async ({ path, oneHook, bothHooks }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
            [path]: oneHook,
        });
        runGitStep(sandbox.path, ['init', '-q']);
        const session = await openSession(sandbox.path);
        expect(readHookStatus(session, session.repository).ready).toBe(false);
        await writeFile(join(sandbox.path, path), bothHooks);
        expect(readHookStatus(session, session.repository)).toStrictEqual({
            ready: true,
            text: `run from ${path}`,
        });
    },
);

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });

    runGitStep(sandbox.path, ['init', '-q']);
    const steps: (readonly string[])[] = [];
    const session = await openSession(sandbox.path);
    expect(installHooks(session, steps)).toBe('');
    expect(steps).toStrictEqual([]);
    expect(readHookStatus(session, session.repository)).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
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
    expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const hook = join(root, `${GSPOT_PATHS.hooks}/pre-commit`);
    const installed = await readFile(hook, 'utf8');
    await writeFile(join(root, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const preview = await runGspot(root, ['apply', '--dry-run', '--json']);
    expect(preview.code).toBe(0);
    expect(
        (JSON.parse(preview.stdout) as DryRunJson).outdated.filter(({ path }) =>
            path.startsWith(`${GSPOT_PATHS.hooks}/`),
        ),
    ).toStrictEqual([
        { path: `${GSPOT_PATHS.hooks}/pre-commit`, kind: 'stray' },
        { path: `${GSPOT_PATHS.hooks}/pre-push`, kind: 'stray' },
    ]);
    expect(await readFile(hook, 'utf8')).toBe(installed);
    const removed = await runGspot(root, ['apply']);
    expect(removed).toMatchObject({
        code: 0,
        stdout: [
            `removed  ${GSPOT_PATHS.hooks}/pre-commit`,
            `removed  ${GSPOT_PATHS.hooks}/pre-push`,
            'note     Git hooks changed. Run gspot install.',
            'note     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.',
            '',
        ].join('\n'),
    });
    expect(await isOnDisk(hook)).toBe(false);
    expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const removedSteps: (readonly string[])[] = [];
    const session = await openSession(root);
    installHooks(session, removedSteps);
    expect(removedSteps).toStrictEqual([['git', 'config', '--unset', 'core.hooksPath']]);
    expect(readGitSetting(root, 'core.hooksPath')).toBeUndefined();
    runGitStep(root, ['config', 'core.hooksPath', '.githooks']);
    const steps: (readonly string[])[] = [];
    expect(installHooks(session, steps)).toBe('');
    expect(steps).toStrictEqual([]);
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
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
    expect(installHooks(session, steps)).toBe('set core.hooksPath to .gspot/hooks');
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.hooks}/post-merge`), 'utf8')).toContain(
        'git lfs post-merge "$@"',
    );
    await writeFile(join(sandbox.path, '.git/hooks/post-merge'), '#!/bin/sh\ngit lfs post-merge "$@"\necho custom\n');
    runGitStep(sandbox.path, ['config', '--unset', 'core.hooksPath']);
    expect(installHooks(session, [])).toBe(buildHookInstructions('.git/hooks', 'mise exec -- gspot'));
});
