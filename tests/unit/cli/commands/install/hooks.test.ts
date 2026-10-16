import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { readGitOutput } from '#tests/setup/git.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { HOOK_REPOSITORIES } from '#tests/data/hooks.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { installHooks, readHookStatus } from '#cli/apply/hooks.ts';
import { matchItems, matchSubstring } from '#tests/setup/matchers.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks and gets the lines to add',
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
        {
            using log = openWriter(sandbox.path);
            const session = await openSession(sandbox.path);
            writeGeneratedFiles(session, generate(session), log);
        }

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
            ready: provider.name !== 'a Lefthook configuration',
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
            json: { drift: matchItems([{ path: '.gspot/hooks/pre-commit', kind: 'stray' }]) },
        });
        expect(await Bun.file(hook).text()).toBe(installed);
        const removed = await runRegisteredCommand(root, ['apply']);
        expect(removed).toMatchObject({ exitCode: 0, text: matchSubstring('Run: gspot install') });
        expect(await isOnDisk(hook)).toBe(false);
        expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
        const removedSteps: (readonly string[])[] = [];
        installHooks(
            await openSession(root).then(({ settingsFile, repository, startRunner }) => ({
                settings: settingsFile.settings,
                repository,
                runner: startRunner,
            })),
            removedSteps,
        );
        expect(removedSteps).toContainEqual(['git', 'config', '--unset', 'core.hooksPath']);
        expect(readGitSetting(root, 'core.hooksPath')).toBeUndefined();
        readGitOutput(root, ['config', 'core.hooksPath', '.githooks']);
        const steps: (readonly string[])[] = [];
        expect(
            installHooks(
                await openSession(root).then(({ settingsFile, repository, startRunner }) => ({
                    settings: settingsFile.settings,
                    repository,
                    runner: startRunner,
                })),
                steps,
            ),
        ).toBe('');
        expect(steps).toStrictEqual([]);
        expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
    },
);

test('a nested gspot.toml reads other hooks from the repository Git hooks folder', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'app');
    const hook = join(sandbox.path, '.githooks/pre-commit');
    await createFileTree(sandbox.path, {
        'app/gspot.toml': buildSettingsText([], { tables: '[hooks]\nenabled = true\n' }),
        '.githooks/pre-commit': '#!/bin/sh\ngspot check --hook pre-commit\n',
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    readGitOutput(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    const context = await openSession(root).then(({ settingsFile, repository, startRunner }) => ({
        settings: settingsFile.settings,
        repository,
        runner: startRunner,
    }));
    expect(readHookStatus(context).ready).toBe(true);
    await Bun.write(hook, '#!/bin/sh\nexit 0\n');
    const absent = readHookStatus(context);
    expect(absent.ready).toBe(false);
    expect(absent.text).toContain('gspot check --hook pre-commit');
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});

async function readHookContext(root: string) {
    const { settingsFile, repository, startRunner } = await openSession(root);
    return { settings: settingsFile.settings, repository, runner: startRunner };
}
