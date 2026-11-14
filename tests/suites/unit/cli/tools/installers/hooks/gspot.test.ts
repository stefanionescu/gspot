import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { rm, chmod, writeFile } from 'node:fs/promises';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { STOCK_LFS_PRE_PUSH } from '#tests/config/tools.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { createGitSandbox, createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });

    const steps: Array<readonly string[]> = [];
    const session = await openSession(sandbox.path);
    expect(await installHooks(session, steps)).toHaveProperty('note', '');
    expect(steps).toStrictEqual([]);
    expect(await readHookStatus(session, session.repository)).toStrictEqual({ ready: true, text: 'none' });
});

test('hooks turned off leave a foreign core.hooksPath unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
    });
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    const session = await openSession(sandbox.path);
    expect(await installHooks(session, [])).toHaveProperty('note', '');
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe('.githooks');
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
});
