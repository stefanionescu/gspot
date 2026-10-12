import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { hookContext } from '#tests/setup/repository.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { installCommand } from '#cli/commands/install.ts';
import { installedVersionResponse } from '#tests/setup/pins.ts';
import { hookStatus, installHooks } from '#cli/install/hooks.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { containingAll, textContaining } from '#tests/setup/matchers.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { HOOK_REPOSITORIES, MISE_INSTALL_RESULT } from '#tests/config/hooks.ts';

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks and gets the lines to add',
    async (provider) => {
        const { startProgram } = provider;
        await using sandbox = await testdir();
        const { files, setting, gitHook } = provider;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([], {
                tables: '[hooks]\nenabled = true\n' + ('settings' in provider ? provider.settings : ''),
            }),
            ...files,
        });
        gitOutput(sandbox.path, ['init', '-q']);
        if (setting !== undefined) gitOutput(sandbox.path, [...setting]);
        if (gitHook) await Bun.write(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
        const before = readGitSetting(sandbox.path, 'core.hooksPath');
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await Bun.file(join(sandbox.path, path)).text() })),
        );
        {
            using log = openOwnershipLog(sandbox.path);
            const session = await openSession(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }

        const steps: (readonly string[])[] = [];
        const text = installHooks(await hookContext(sandbox.path), steps);
        expect({ steps, text }).toStrictEqual({ steps: [], text: textContaining('add these gspot lines to them') });
        const command = startProgram === 'mise' ? 'mise exec -- gspot' : 'npm exec --no -- gspot';
        expect(text.split('\n')).toStrictEqual(
            containingAll([
                textContaining(`pre-commit: ${command} check --hook pre-commit`),
                textContaining(`pre-push: ${command} check --hook pre-push -- "$@"`),
            ]),
        );
        const native = processes.run;
        const editorconfig = toolDeclaration(configurationManifests().values(), 'editorconfig-checker');
        using installer = spyOn(processes, 'run').mockImplementation((argv, options, output) => {
            if (argv[0] === 'mise') return Promise.resolve(MISE_INSTALL_RESULT);
            const version = installedVersionResponse(sandbox.path, argv, editorconfig);
            if (version !== undefined) return Promise.resolve(version);
            return native(argv, options, output);
        });
        expect(await installCommand(sandbox.path)).toMatchObject({ exitCode: 0, text: textContaining(text) });
        expect(
            installer.mock.calls.some(([argv]) => argv[0] === 'mise' && argv[1] === 'install' && argv.length > 2),
        ).toBe(true);
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);

        expect(hookStatus(await hookContext(sandbox.path))).toStrictEqual({
            ready: false,
            text: `not installed; ${text}`,
        });
        const first = authored.find(({ path }) => path !== 'package.json');
        await Bun.write(join(sandbox.path, first!.path), `${first!.content}\n${command} check --hook pre-commit\n`);
        expect(hookStatus(await hookContext(sandbox.path))).toMatchObject({ ready: true });
    },
);

test('a gspot.toml without hooks installs none', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText([], {}) });
    gitOutput(sandbox.path, ['init', '-q']);
    const steps: (readonly string[])[] = [];
    expect(installHooks(await hookContext(sandbox.path), steps)).toBe('');
    expect(steps).toStrictEqual([]);
    expect(hookStatus(await hookContext(sandbox.path))).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test.each(['', 'app/'])(
    'turning hooks off removes %s.gspot/hooks and leaves unsetting core.hooksPath to install',
    async (prefix) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, prefix);
        const settings = settingsText([], { tables: '[hooks]\nenabled = true\n' });
        await createFileTree(root, { 'gspot.toml': settings });
        gitOutput(sandbox.path, ['init', '-q']);
        expect(await applyCommand({ cwd: root, isDryRun: false })).toHaveProperty('exitCode', 0);
        const ownPath = `${prefix}.gspot/hooks`;
        gitOutput(root, ['config', 'core.hooksPath', ownPath]);
        expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
        const hook = join(root, '.gspot/hooks/pre-commit');
        const installed = await Bun.file(hook).text();
        await Bun.write(join(root, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
        const preview = await applyCommand({ cwd: root, isDryRun: true });
        expect(preview).toMatchObject({
            exitCode: 0,
            json: { drift: containingAll([{ path: '.gspot/hooks/pre-commit', kind: 'stray' }]) },
        });
        expect(await Bun.file(hook).text()).toBe(installed);
        const removed = await applyCommand({ cwd: root, isDryRun: false });
        expect(removed).toMatchObject({ exitCode: 0, text: textContaining('Run: gspot install') });
        expect(await pathExists(hook)).toBe(false);
        expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
        const native = processes.run;
        const editorconfig = toolDeclaration(configurationManifests().values(), 'editorconfig-checker');
        using _installer = spyOn(processes, 'run').mockImplementation((argv, options, output) => {
            const version = installedVersionResponse(root, argv, editorconfig);
            return version === undefined ? native(argv, options, output) : Promise.resolve(version);
        });
        const installedResult = await installCommand(root);
        expect(installedResult, installedResult.text).toMatchObject({
            exitCode: 0,
            json: { steps: containingAll([['git', 'config', '--unset', 'core.hooksPath']]) },
        });
        expect(readGitSetting(root, 'core.hooksPath')).toBeUndefined();
        gitOutput(root, ['config', 'core.hooksPath', '.githooks']);
        const steps: (readonly string[])[] = [];
        expect(installHooks(await hookContext(root), steps)).toBe('');
        expect(steps).toStrictEqual([]);
        expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
    },
);

test('a nested gspot.toml reads other hooks from the repository Git hooks folder', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'app');
    const hook = join(sandbox.path, '.githooks/pre-commit');
    await createFileTree(sandbox.path, {
        'app/gspot.toml': settingsText([], { tables: '[hooks]\nenabled = true\n' }),
        '.githooks/pre-commit': '#!/bin/sh\ngspot check --hook pre-commit\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    const context = await hookContext(root);
    expect(hookStatus(context).ready).toBe(true);
    await Bun.write(hook, '#!/bin/sh\nexit 0\n');
    const absent = hookStatus(context);
    expect(absent.ready).toBe(false);
    expect(absent.text).toContain('gspot check --hook pre-commit');
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});
