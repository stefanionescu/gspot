import { expect, test } from 'bun:test';
import { join, relative } from 'node:path';
import { rejects } from 'node:assert/strict';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { installHooks } from '#cli/lifecycle/hooks/git.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { containingAll } from '#tests/support/expectations.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { expectUninstallRemovesHooks } from '#tests/support/cli/hooks.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';

test.each(['default', 'external'] as const)(
    'nested uninstall reports the retained hook and original backup in the %s Git boundary',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        const root = join(sandbox.path, 'project');
        await createFileTree(sandbox.path, {
            'project/gspot.toml':
                'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        });
        expect(processes.runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
        if (kind === 'external') await createFileTree(external.path, { 'hooks/.keep': '' });
        const configured =
            kind === 'external'
                ? processes.runBlocking(['git', 'config', 'core.hooksPath', join(external.path, 'hooks')], {
                      cwd: sandbox.path,
                  })
                : undefined;
        expect(configured?.code ?? 0, configured?.stderr).toBe(0);
        const location = hookLocation(root);
        const hook = join(location.absolute, 'pre-commit');
        const original = '#!/bin/sh\nprintf private-original\n';
        writeFileSync(hook, original, { mode: 0o751 });
        installHooks(
            await openSession(root).then((session) => ({
                policy: session.policyFiles.policy,
                repository: session.repository,
            })),
        );
        const installed = readFileSync(hook);
        const entry = readOwnership(location.root, location.stateDirectory).files.find(
            (file) => file.path === `${location.directory}/pre-commit`,
        )!;
        const backup = join(location.root, entry.original!.backup);
        writeFileSync(hook, '#!/bin/sh\nprintf later-edit\n');
        const conflict = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(conflict.json).toMatchObject({
            preserved: containingAll([relative(root, hook)]),
            originals: containingAll([{ path: hook, backup }]),
        });
        expect(conflict.text).toContain(hook);
        expect(conflict.text).toContain(backup);
        expect(conflict.text).not.toContain('private-original');
        expect(readFileSync(backup, 'utf8')).toBe(original);
        expect(readFileSync(hook, 'utf8')).toContain('later-edit');
        writeFileSync(hook, installed);
        const restored = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(restored.json).toMatchObject({ preserved: [], originals: [] });
        expect(readFileSync(hook, 'utf8')).toBe(original);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
    },
);

test.each([undefined, 'custom-hooks'])(
    'apply preserves Git and package configuration without integrations (%s)',
    async (hooksPath) => {
        const packageText = '{"private":true,"scripts":{"prepare":"build-app","check":"check-app"}}';
        const hookText = '#!/bin/sh\nprintf app-hook\n';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
            'package.json': packageText,
            'custom-hooks/pre-commit': hookText,
        });
        const initialized = await processes.run(['git', 'init', '--quiet'], { cwd: sandbox.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        const configured =
            hooksPath === undefined
                ? undefined
                : await processes.run(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path });
        expect(configured?.code ?? 0, configured?.stderr).toBe(0);
        const configPath = join(sandbox.path, '.git/config');
        const originalConfig = readFileSync(configPath);
        await applyAll(await openSession(sandbox.path));
        expect(readFileSync(configPath)).toStrictEqual(originalConfig);
        expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe(packageText);
        expect(readFileSync(join(sandbox.path, 'custom-hooks/pre-commit'), 'utf8')).toBe(hookText);
        expect(existsSync(join(sandbox.path, '.gspot/hooks'))).toBe(false);
        expect(existsSync(join(sandbox.path, '.github/workflows/gspot.yml'))).toBe(false);
    },
);

test('a hooks integration outside Git does not create hook files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    await applyAll(await openSession(sandbox.path));
    const installed = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(installed.exitCode).toBe(0);
    expect(existsSync(join(sandbox.path, '.gspot/hooks'))).toBe(false);
});

test('omitting hooks preserves existing managed hook files and their Git location', async () => {
    const hook = '#!/bin/sh\nprintf kept-hook\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
        '.gspot/hooks/pre-commit': hook,
    });
    for (const args of [
        ['init', '--quiet'],
        ['add', '.gspot/hooks/pre-commit'],
        ['config', 'core.hooksPath', '.gspot/hooks'],
    ]) {
        const result = await processes.run(['git', ...args], { cwd: sandbox.path });
        expect(result.code, result.stderr).toBe(0);
    }
    const config = readFileSync(join(sandbox.path, '.git/config'));
    await applyAll(await openSession(sandbox.path));
    expect(readFileSync(join(sandbox.path, '.gspot/hooks/pre-commit'), 'utf8')).toBe(hook);
    expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
});

test('hook sibling collisions refuse the whole installation before another hook is changed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    const ran = await processes.run(['git', 'init', '-q'], { cwd: sandbox.path });
    expect(ran.code).toBe(0);
    const directory = hookLocation(sandbox.path).absolute;
    writeFileSync(join(directory, 'pre-push.gspot-original'), 'authored sibling');
    const refused = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(refused.exitCode).toBe(2);
    expect(refused.text).toContain('Hook sibling already exists');
    expect(existsSync(join(directory, 'pre-commit'))).toBe(false);
    expect(readFileSync(join(directory, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
});

test('a concurrent hook writer is refused and installation succeeds after its lock is released', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    const ran = await processes.run(['git', 'init', '-q'], { cwd: sandbox.path });
    expect(ran.code).toBe(0);
    const location = hookLocation(sandbox.path);
    const owner = openLifecycleOwner(location.root);
    try {
        const rejected = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(rejected.exitCode).toBe(2);
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        owner.close();
    }
    const installed = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(installed.exitCode).toBe(0);
});

test.each(['linked-hooks', 'linked-hooks/nested'])(
    'symbolic hook path %s cannot redirect lifecycle writes outside its Git-resolved boundary',
    async (hookPath) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        });
        await createFileTree(outside.path, {
            'pre-commit': '#!/bin/sh\nexit 17\n',
            'nested/pre-commit': '#!/bin/sh\nexit 17\n',
        });
        chmodSync(join(outside.path, 'pre-commit'), 0o755);
        chmodSync(join(outside.path, 'nested/pre-commit'), 0o755);
        for (const args of [
            ['init', '-q'],
            ['config', 'core.hooksPath', hookPath],
        ]) {
            const ran = await processes.run(['git', ...args], { cwd: sandbox.path });
            expect(ran.code).toBe(0);
        }
        const session = await openSession(sandbox.path);
        symlinkSync(outside.path, join(sandbox.path, 'linked-hooks'));
        expect(() => installHooks({ policy: session.policyFiles.policy, repository: session.repository })).toThrow(
            /Unsafe lifecycle/u,
        );
        await rejects(installCommand({ cwd: sandbox.path, isDryRun: false }), {
            message: /Source link leaves the repository/u,
        });
        expect(readFileSync(join(outside.path, 'pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 17\n');
        expect(existsSync(join(outside.path, 'pre-push'))).toBe(false);
    },
);

test('relative Git hook paths resolve from the Git root when policy is nested', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'app/gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        'shared-hooks/.keep': '',
    });
    expect(processes.runBlocking(['git', 'init', '-q'], { cwd: directory.path }).code).toBe(0);
    expect(
        processes.runBlocking(['git', 'config', 'core.hooksPath', 'shared-hooks'], { cwd: directory.path }).code,
    ).toBe(0);
    const root = join(directory.path, 'app');
    expect(hookLocation(root).absolute).toBe(join(directory.path, 'shared-hooks'));
    installHooks(
        await openSession(root).then((session) => ({
            policy: session.policyFiles.policy,
            repository: session.repository,
        })),
    );
    expect(existsSync(join(directory.path, 'shared-hooks/pre-commit'))).toBe(true);
    expect(existsSync(join(root, 'shared-hooks'))).toBe(false);
});

test('a nested hook boundary keeps recovery ignored through installation and restoration', async () => {
    await using sandbox = await testdir();
    const original = '#!/bin/sh\nexit 0\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        'custom/hooks/pre-commit': original,
    });
    chmodSync(join(sandbox.path, 'custom/hooks/pre-commit'), 0o755);
    for (const args of [
        ['init', '-q'],
        ['config', 'core.hooksPath', 'custom/hooks'],
    ])
        expect(processes.runBlocking(['git', ...args], { cwd: sandbox.path }).code).toBe(0);
    const session = await openSession(sandbox.path);
    installHooks({ policy: session.policyFiles.policy, repository: session.repository });
    const boundary = sandbox.path;
    const backup = readOwnership(boundary).files.find((entry) => entry.path === 'custom/hooks/pre-commit')!.original!
        .backup;
    for (const path of ['.gspot/state/ownership.json', backup])
        expect(processes.runBlocking(['git', 'check-ignore', '--', path], { cwd: sandbox.path }).code).toBe(0);
    const uninstalled = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(uninstalled.exitCode).toBe(0);
    expect(readFileSync(join(boundary, 'custom/hooks/pre-commit'), 'utf8')).toBe(original);
    expect(readFileSync(join(boundary, backup), 'utf8')).toBe(original);
    expect(processes.runBlocking(['git', 'check-ignore', '--', backup], { cwd: sandbox.path }).code).toBe(0);
});

test('a nested policy preserves tracked hooks outside its own directory', async () => {
    await using sandbox = await testdir();
    const original = '#!/bin/sh\nexit 0\n';
    await createFileTree(sandbox.path, {
        'project/gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        'hooks/pre-commit': original,
    });
    chmodSync(join(sandbox.path, 'hooks/pre-commit'), 0o755);
    for (const args of [
        ['init', '-q'],
        ['add', '.'],
        ['config', 'core.hooksPath', 'hooks'],
    ])
        expect(processes.runBlocking(['git', ...args], { cwd: sandbox.path }).code).toBe(0);
    const session = await openSession(join(sandbox.path, 'project'));
    expect(() => installHooks({ policy: session.policyFiles.policy, repository: session.repository })).toThrow(
        'Retained tracked hook',
    );
    expect(readFileSync(join(sandbox.path, 'hooks/pre-commit'), 'utf8')).toBe(original);
    expect(existsSync(join(sandbox.path, 'hooks/pre-commit.gspot-original'))).toBe(false);
});

test('Git hooks can use the repository root without an empty confined path', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'repository/gspot.toml':
            'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    const root = join(sandbox.path, 'repository');
    for (const args of [
        ['init', '--quiet'],
        ['config', 'core.hooksPath', '.'],
    ])
        expect(processes.runBlocking(['git', ...args], { cwd: root }).code).toBe(0);
    expect(hookLocation(root).absolute).toBe(root);
    installHooks(
        await openSession(root).then((session) => ({
            policy: session.policyFiles.policy,
            repository: session.repository,
        })),
    );
    await expectUninstallRemovesHooks(root, root);
});
