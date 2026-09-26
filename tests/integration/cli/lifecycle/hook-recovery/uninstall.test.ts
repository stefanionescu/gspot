import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { installHooks } from '#cli/lifecycle/hooks/git.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

test.each([true, false])(
    'uninstall describes only owned hooks and preserves hooksPath when an original exists: %s',
    async (hasOriginal) => {
        await using directory = await testdir();
        const original = '#!/bin/sh\nexit 0\n';
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
            '.custom-hooks/.keep': '',
            ...(hasOriginal ? { '.custom-hooks/pre-commit': original } : {}),
        });
        expect(processes.runBlocking(['git', 'init', '-q'], { cwd: directory.path }).code).toBe(0);
        expect(
            processes.runBlocking(['git', 'config', 'core.hooksPath', '.custom-hooks'], { cwd: directory.path }).code,
        ).toBe(0);
        const options = { cwd: directory.path, yes: true, isDryRun: true };
        const uninstalled = await uninstallCommand(options);
        expect(uninstalled.text).not.toContain('dispatchers');
        if (hasOriginal) chmodSync(join(directory.path, '.custom-hooks/pre-commit'), 0o751);
        installHooks(
            await openSession(directory.path).then((session) => ({
                policy: session.policyFiles.policy,
                repository: session.repository,
            })),
        );
        const hook = join(directory.path, '.custom-hooks/pre-commit');
        const installed = readFileSync(hook);
        const previewed = await uninstallCommand(options);
        expect(previewed.text).toContain('restore or remove unchanged dispatchers');
        expect(readFileSync(hook)).toStrictEqual(installed);
        const removed = await uninstallCommand({ ...options, isDryRun: false });
        expect(removed.exitCode).toBe(0);
        // The authored hook comes back; a hook gspot created is removed.
        expect(existsSync(hook) ? readFileSync(hook, 'utf8') : undefined).toBe(hasOriginal ? original : undefined);
        expect(
            processes.runBlocking(['git', 'config', '--get', 'core.hooksPath'], { cwd: directory.path }).stdout.trim(),
        ).toBe('.custom-hooks');
        const repeated = await uninstallCommand(options);
        expect(repeated.text).not.toContain('dispatchers');
    },
);

test.each(['missing', 'malformed'])(
    'uninstall restores a nested installation from ownership when policy is %s',
    async (condition) => {
        await using sandbox = await testdir();
        const rootPolicy = 'version = 1\nconfigurations = []\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': rootPolicy,
            'project/gspot.toml':
                'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
            'project/authored.txt': 'original bytes',
            'project/.gspot/unowned.json': '{"authored":true}',
            'project/child/.keep': '',
        });
        expect(processes.runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
        const root = join(sandbox.path, 'project');
        const owner = openLifecycleOwner(root);
        try {
            owner.replace('authored.txt', { bytes: Buffer.from('installed'), mode: 0o644 }, 'config', true);
            owner.replace('removed.txt', { bytes: Buffer.from('generated'), mode: 0o644 }, 'config');
        } finally {
            owner.close();
        }
        installHooks(
            await openSession(root).then((session) => ({
                policy: session.policyFiles.policy,
                repository: session.repository,
            })),
        );
        rmSync(join(root, 'removed.txt'));
        if (condition === 'missing') rmSync(join(root, 'gspot.toml'));
        else writeFileSync(join(root, 'gspot.toml'), 'malformed [');
        const preview = await uninstallCommand({ cwd: join(root, 'child'), yes: true, isDryRun: true });
        expect(preview.exitCode).toBe(0);
        expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('installed');
        const restored = await uninstallCommand({ cwd: join(root, 'child'), yes: true, isDryRun: false });
        expect(restored.exitCode).toBe(0);
        expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('original bytes');
        expect(readFileSync(join(root, '.gspot/unowned.json'), 'utf8')).toBe('{"authored":true}');
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(rootPolicy);
        expect(existsSync(join(hookLocation(root).absolute, 'pre-commit'))).toBe(false);
        expect(existsSync(join(root, 'removed.txt'))).toBe(false);
    },
);

test('uninstall reports both restoration-conflict paths and restores the original after the edit is moved aside', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
        'authored.txt': 'private original bytes',
    });
    const owner = openLifecycleOwner(sandbox.path);
    try {
        owner.replace('authored.txt', { bytes: Buffer.from('installed bytes'), mode: 0o644 }, 'config', true);
    } finally {
        owner.close();
    }
    const backup = readOwnership(sandbox.path).files.find((entry) => entry.path === 'authored.txt')!.original!.backup;
    writeFileSync(join(sandbox.path, 'authored.txt'), 'later authored bytes');
    const conflict = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(conflict.text).toContain('authored.txt');
    expect(conflict.text).toContain(backup);
    expect(conflict.text).not.toContain('private original bytes');
    expect(conflict.json).toMatchObject({
        preserved: ['authored.txt'],
        originals: [{ backup: textContaining(backup) }],
    });
    expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('later authored bytes');
    expect(readFileSync(join(sandbox.path, backup), 'utf8')).toBe('private original bytes');
    writeFileSync(join(sandbox.path, 'authored.txt'), 'installed bytes');
    const restored = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(restored.json).toMatchObject({ preserved: [], originals: [] });
    expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('private original bytes');
});

test('uninstall acquires the hook boundary before removing repository outputs', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect(processes.runBlocking(['git', 'init', '-q'], { cwd: directory.path }).code).toBe(0);
    const session = await openSession(directory.path);
    installHooks({ policy: session.policyFiles.policy, repository: session.repository });
    const repository = openLifecycleOwner(directory.path);
    try {
        repository.replace('owned.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config');
    } finally {
        repository.close();
    }
    const location = hookLocation(directory.path);
    const hook = readFileSync(join(location.absolute, 'pre-commit'));
    const locked = openLifecycleOwner(location.root);
    try {
        await rejects(uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false }), {
            message: /Another lifecycle writer/u,
        });
        expect(readFileSync(join(directory.path, 'owned.txt'), 'utf8')).toBe('installed\n');
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(hook);
    } finally {
        locked.close();
    }
    const uninstalled = await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false });
    expect(uninstalled.exitCode).toBe(0);
    expect(existsSync(join(directory.path, 'owned.txt'))).toBe(false);
    expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
});
