import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { listHookNames } from '#cli/generation/hooks.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { installHooks, readHookStatus } from '#cli/install/hooks.ts';
import { matchItems, matchSubstring } from '#tests/setup/matchers.ts';
import { readGitOutput, createLfsRepository } from '#tests/setup/git.ts';
import { HOOK_REPOSITORIES, STOCK_LFS_PRE_PUSH, HOOK_CONFIGURATION_CASES } from '#tests/data/hooks.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks, gets the lines to add, and is ready only after both lines',
    async (provider) => {
        const { startProgram } = provider;
        await using sandbox = await testdir();
        const { files, setting, gitHook } = provider;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([], {
                tables: '[hooks]\nenabled = true\n' + ('settings' in provider ? provider.settings : ''),
            }),
            ...files,
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        if (setting !== undefined) readGitOutput(sandbox.path, [...setting]);
        if (gitHook) await Bun.write(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
        const before = readGitSetting(sandbox.path, 'core.hooksPath');
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await Bun.file(join(sandbox.path, path)).text() })),
        );
        await writeGenerated(sandbox.path);

        const steps: (readonly string[])[] = [];
        const text = installHooks(await readHookContext(sandbox.path), steps);
        expect({ steps, text }).toStrictEqual({ steps: [], text: matchSubstring('add these gspot lines to them') });
        const command = startProgram === 'mise' ? 'mise exec -- gspot' : 'npm exec --no -- gspot';
        expect(text.split('\n')).toStrictEqual(
            matchItems([
                matchSubstring(`pre-commit: ${command} check --hook pre-commit`),
                matchSubstring(`pre-push: ${command} check --hook pre-push -- "$@"`),
            ]),
        );
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);

        expect(readHookStatus(await readHookContext(sandbox.path))).toStrictEqual({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await Bun.write(join(sandbox.path, first!.path), `${first!.content}\n${command} check --hook pre-commit\n`);
        expect(readHookStatus(await readHookContext(sandbox.path))).toMatchObject({
            ready: false,
        });
        await Bun.write(
            join(sandbox.path, first!.path),
            `${first!.content}\n${command} check --hook pre-commit\n${command} check --hook pre-push\n`,
        );
        expect(readHookStatus(await readHookContext(sandbox.path))).toMatchObject({ ready: true });
    },
);

test.each([...HOOK_CONFIGURATION_CASES])(
    'hooks in $path are ready only after both commands',
    async ({ path, oneHook, bothHooks }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText([], { tables: '[hooks]\nenabled = true\n' }),
            [path]: oneHook,
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        expect(readHookStatus(await readHookContext(sandbox.path)).ready).toBe(false);
        await Bun.write(join(sandbox.path, path), bothHooks);
        expect(readHookStatus(await readHookContext(sandbox.path))).toStrictEqual({
            ready: true,
            text: `run from ${path}`,
        });
    },
);

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildSettingsText([], {}) });
    readGitOutput(sandbox.path, ['init', '-q']);
    const steps: (readonly string[])[] = [];
    expect(installHooks(await readHookContext(sandbox.path), steps)).toBe('');
    expect(steps).toStrictEqual([]);
    expect(readHookStatus(await readHookContext(sandbox.path))).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test.each(['', 'app/'])(
    'turning hooks off removes %s.gspot/hooks and leaves unsetting core.hooksPath to install',
    async (prefix) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, prefix);
        const settings = buildSettingsText([], { tables: '[hooks]\nenabled = true\n' });
        await createFileTree(root, { 'gspot.toml': settings });
        readGitOutput(sandbox.path, ['init', '-q']);
        expect(await runRegisteredCommand(root, ['apply'])).toHaveProperty('exitCode', 0);
        const ownPath = `${prefix}.gspot/hooks`;
        readGitOutput(root, ['config', 'core.hooksPath', ownPath]);
        expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
        const hook = join(root, '.gspot/hooks/pre-commit');
        const installed = await Bun.file(hook).text();
        await Bun.write(join(root, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
        const preview = await runRegisteredCommand(root, ['apply', '--dry-run']);
        expect(preview).toMatchObject({
            exitCode: 0,
            json: { stale: matchItems([{ path: '.gspot/hooks/pre-commit', kind: 'stray' }]) },
        });
        expect(await Bun.file(hook).text()).toBe(installed);
        const removed = await runRegisteredCommand(root, ['apply']);
        expect(removed).toMatchObject({ exitCode: 0, text: matchSubstring('Run: gspot install') });
        expect(await isOnDisk(hook)).toBe(false);
        expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
        const removedSteps: (readonly string[])[] = [];
        installHooks(await readHookContext(root), removedSteps);
        expect(removedSteps).toContainEqual(['git', 'config', '--unset', 'core.hooksPath']);
        expect(readGitSetting(root, 'core.hooksPath')).toBeUndefined();
        readGitOutput(root, ['config', 'core.hooksPath', '.githooks']);
        const steps: (readonly string[])[] = [];
        expect(installHooks(await readHookContext(root), steps)).toBe('');
        expect(steps).toStrictEqual([]);
        expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
    },
);

test('a nested gspot.toml reads other hooks from the repository Git hooks folder and is ready only with every hook line', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'app');
    const hook = join(sandbox.path, '.githooks/pre-commit');
    await createFileTree(sandbox.path, {
        'app/gspot.toml': buildSettingsText([], { tables: '[hooks]\nenabled = true\n' }),
        '.githooks/pre-commit': '#!/bin/sh\ngspot check --hook pre-commit\n',
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    readGitOutput(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    const context = await readHookContext(root);
    expect(readHookStatus(context).ready).toBe(false);
    await Bun.write(join(sandbox.path, '.githooks/pre-push'), '#!/bin/sh\ngspot check --hook pre-push\n');
    expect(readHookStatus(context).ready).toBe(true);
    await Bun.write(hook, '#!/bin/sh\nexit 0\n');
    const absent = readHookStatus(context);
    expect(absent.ready).toBe(false);
    expect(absent.text).toContain('gspot check --hook pre-commit');
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});

test('the hooks that git lfs install wrote are not other hooks, so install points Git at the gspot hooks', async () => {
    await using sandbox = await createLfsRepository();
    await Bun.write(join(sandbox.path, '.git/hooks/pre-push'), STOCK_LFS_PRE_PUSH);
    await Bun.write(
        join(sandbox.path, '.git/hooks/post-merge'),
        STOCK_LFS_PRE_PUSH.replaceAll('pre-push', 'post-merge'),
    );
    await writeGenerated(sandbox.path);
    const steps: (readonly string[])[] = [];
    expect(installHooks(await readHookContext(sandbox.path), steps)).toBe('set core.hooksPath to .gspot/hooks');
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe('.gspot/hooks');
    expect(await Bun.file(join(sandbox.path, '.gspot/hooks/post-merge')).text()).toContain('git lfs post-merge "$@"');
    await Bun.write(join(sandbox.path, '.git/hooks/post-merge'), '#!/bin/sh\ngit lfs post-merge "$@"\necho custom\n');
    readGitOutput(sandbox.path, ['config', '--unset', 'core.hooksPath']);
    expect(installHooks(await readHookContext(sandbox.path), [])).toContain('hooks already run from .git/hooks');
});

async function writeGenerated(root: string): Promise<void> {
    using log = openWriter(root);
    const session = await openSession(root);
    writeGeneratedFiles(session, generate(session), log);
}

async function readHookContext(root: string) {
    const { settingsFile, repository, startRunner, configuredChecks } = await openSession(root);
    return { settings: settingsFile.settings, repository, runner: startRunner, hooks: listHookNames(configuredChecks) };
}
