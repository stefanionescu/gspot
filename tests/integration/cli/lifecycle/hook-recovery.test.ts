import { applyAll } from '#cli/commands/apply/workflow.ts';
import { installCommand } from '#cli/commands/install.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { openSession } from '#cli/execution/session.ts';
import { hookLocation, hookStatus, installHooks } from '#cli/lifecycle/hooks/git.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import * as processes from '#cli/platform/spawn.ts';
import { expect, test } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

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
        expect((await uninstallCommand(options)).text).not.toContain('dispatchers');
        if (hasOriginal) chmodSync(join(directory.path, '.custom-hooks/pre-commit'), 0o751);
        installHooks(
            await openSession(directory.path).then((session) => ({
                policy: session.policyFiles.policy,
                repository: session.repository,
            })),
        );
        const hook = join(directory.path, '.custom-hooks/pre-commit');
        const installed = readFileSync(hook);
        expect((await uninstallCommand(options)).text).toContain('restore or remove unchanged dispatchers');
        expect(readFileSync(hook)).toStrictEqual(installed);
        expect((await uninstallCommand({ ...options, isDryRun: false })).exitCode).toBe(0);
        if (hasOriginal) expect(readFileSync(hook, 'utf8')).toBe(original);
        else expect(existsSync(hook)).toBe(false);
        expect(
            processes.runBlocking(['git', 'config', '--get', 'core.hooksPath'], { cwd: directory.path }).stdout.trim(),
        ).toBe('.custom-hooks');
        expect((await uninstallCommand(options)).text).not.toContain('dispatchers');
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
        originals: [{ backup: expect.stringContaining(backup) }],
    });
    expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('later authored bytes');
    expect(readFileSync(join(sandbox.path, backup), 'utf8')).toBe('private original bytes');
    writeFileSync(join(sandbox.path, 'authored.txt'), 'installed bytes');
    const restored = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(restored.json).toMatchObject({ preserved: [], originals: [] });
    expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('private original bytes');
});

test.each(['default', 'external', 'worktree'] as const)(
    'installed dispatchers preserve executable hooks, input, status, and originals in %s Git locations',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await using launcher = await testdir();
        const policy = 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n';
        await createFileTree(sandbox.path, { 'gspot.toml': policy });
        for (const args of [
            ['init', '-q'],
            ['add', 'gspot.toml'],
            ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base'],
        ]) {
            const result = await processes.run(['git', ...args], { cwd: sandbox.path });
            expect(result.code, result.stderr).toBe(0);
        }
        let root = sandbox.path;
        if (kind === 'external') {
            await createFileTree(external.path, { "author's hooks/.keep": '' });
            expect(
                (
                    await processes.run(['git', 'config', 'core.hooksPath', join(external.path, "author's hooks")], {
                        cwd: root,
                    })
                ).code,
            ).toBe(0);
        }
        if (kind === 'worktree') {
            root = join(external.path, "linked author's tree");
            const result = await processes.run(['git', 'worktree', 'add', '--detach', root, 'HEAD'], {
                cwd: sandbox.path,
            });
            expect(result.code, result.stderr).toBe(0);
        }
        const directory = hookLocation(root).absolute;
        const hook = join(directory, 'pre-push');
        const original = `#!/usr/bin/env bun\nawait Bun.write('original.json', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text(), cwd: process.cwd()}));\nprocess.exit(0);\n`;
        writeFileSync(hook, original, { mode: 0o751 });
        await createFileTree(launcher.path, {
            gspot: `#!/usr/bin/env bun\nawait Bun.write('gspot.json', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text(), cwd: process.cwd(), hook: process.env.GSPOT_HOOK}));\nprocess.exit(0);\n`,
        });
        chmodSync(join(launcher.path, 'gspot'), 0o755);
        const config = readFileSync(join(sandbox.path, '.git/config'));
        const before = readFileSync(hook);
        const preview = await installCommand({ cwd: root, isDryRun: true });
        expect(preview.exitCode, preview.text).toBe(0);
        expect(preview.text).toContain(directory);
        expect(readFileSync(hook)).toStrictEqual(before);
        await applyAll(await openSession(root));
        expect(readFileSync(hook)).toStrictEqual(before);
        for (let attempt = 0; attempt < 2; attempt++) {
            const installed = await installCommand({ cwd: root, isDryRun: false });
            expect(installed.exitCode, installed.text).toBe(0);
        }
        expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(original);
        expect(statSync(`${hook}.gspot-original`).mode & 0o777).toBe(0o751);
        const env = { PATH: `${launcher.path}${delimiter}${environmentVariables()['PATH'] ?? ''}` };
        const input = 'refs/heads/main abc refs/heads/main def\nrefs/tags/v1 ghi refs/tags/v1 jkl\n';
        const chained = await processes.run([hook, 'remote name', 'ssh://example.com/a b'], {
            cwd: root,
            env,
            stdin: input,
        });
        expect(chained.code, chained.stderr).toBe(0);
        const first = JSON.parse(readFileSync(join(root, 'original.json'), 'utf8'));
        const second = JSON.parse(readFileSync(join(root, 'gspot.json'), 'utf8'));
        expect(first.args).toStrictEqual(['remote name', 'ssh://example.com/a b']);
        expect(second.args).toStrictEqual(['check', '--push', '--', 'remote name', 'ssh://example.com/a b']);
        expect(first.input).toBe(input);
        expect(second.input).toBe(input);
        expect(first.cwd).toBe(second.cwd);
        expect(second.hook).toBe('pre-push');
        rmSync(join(root, 'gspot.json'));
        const editedOriginal = original.replace('process.exit(0)', 'process.exit(19)');
        writeFileSync(`${hook}.gspot-original`, editedOriginal);
        const refused = await processes.run([hook, 'origin', 'url'], { cwd: root, env, stdin: input });
        expect(refused.code).toBe(19);
        expect(existsSync(join(root, 'gspot.json'))).toBe(false);
        const editedDispatcher = readFileSync(join(directory, 'pre-commit'), 'utf8') + '# authored addition\n';
        writeFileSync(join(directory, 'pre-commit'), editedDispatcher);
        expect(
            hookStatus(
                await openSession(root).then((session) => ({
                    policy: session.policyFiles.policy,
                    repository: session.repository,
                })),
            ).text,
        ).toContain('missing or edited pre-commit');
        const removed = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(readFileSync(join(directory, 'pre-commit'), 'utf8')).toBe(editedDispatcher);
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(editedOriginal);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(editedOriginal);
        expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
    },
);

test.each(['before', 'after'] as const)(
    'hook installation recovers interruption %s dispatcher publication',
    async (point) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        });
        expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
        const location = hookLocation(sandbox.path);
        const hook = join(location.absolute, 'pre-push');
        const original = '#!/bin/sh\nexit 0\n';
        writeFileSync(hook, original, { mode: 0o751 });
        const boundary = fileURLToPath(new URL('../../../../packages/cli/src/platform/filesystem.ts', import.meta.url));
        const installer = fileURLToPath(new URL('../../../../packages/cli/src/commands/install.ts', import.meta.url));
        const child = `
        import { mock } from 'bun:test';
        const boundary = await import(${JSON.stringify(boundary)});
        const open = boundary.openConfinedRoot;
        mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
            const files = open(root);
            return { ...files, write(path, value, expected) {
                if (path === 'hooks/pre-push' && ${JSON.stringify(point)} === 'before') process.exit(73);
                files.write(path, value, expected);
                if (path === 'hooks/pre-push' && ${JSON.stringify(point)} === 'after') process.exit(73);
            } };
        } }));
        const { installCommand } = await import(${JSON.stringify(installer)});
        await installCommand({ cwd: process.cwd(), isDryRun: false });
    `;
        const interrupted = await processes.run([process.execPath, '-e', child], { cwd: sandbox.path });
        expect(interrupted.code, interrupted.stderr).toBe(73);
        const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(retry.exitCode, retry.text).toBe(0);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(original);
        const removed = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(original);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(existsSync(`${hook}.gspot-original`)).toBe(false);
    },
);

test('uninstall recovers after restoring an original hook and before removing its retained sibling', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const location = hookLocation(sandbox.path);
    const hook = join(location.absolute, 'pre-push');
    const original = '#!/bin/sh\nexit 0\n';
    writeFileSync(hook, original, { mode: 0o751 });
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const boundary = fileURLToPath(new URL('../../../../packages/cli/src/platform/filesystem.ts', import.meta.url));
    const uninstall = fileURLToPath(new URL('../../../../packages/cli/src/commands/uninstall.ts', import.meta.url));
    const child = `
        import { mock } from 'bun:test';
        const boundary = await import(${JSON.stringify(boundary)});
        const open = boundary.openConfinedRoot;
        mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
            const files = open(root);
            return { ...files, remove(path, expected) {
                if (path === 'hooks/pre-push.gspot-original') process.exit(73);
                files.remove(path, expected);
            } };
        } }));
        const { uninstallCommand } = await import(${JSON.stringify(uninstall)});
        await uninstallCommand({ cwd: process.cwd(), yes: true, isDryRun: false });
    `;
    const interrupted = await processes.run([process.execPath, '-e', child], { cwd: sandbox.path });
    expect(interrupted.code, interrupted.stderr).toBe(73);
    expect(readFileSync(hook, 'utf8')).toBe(original);
    expect(existsSync(`${hook}.gspot-original`)).toBe(true);
    const retry = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(retry.exitCode, retry.text).toBe(0);
    expect(readFileSync(hook, 'utf8')).toBe(original);
    expect(statSync(hook).mode & 0o777).toBe(0o751);
    expect(existsSync(`${hook}.gspot-original`)).toBe(false);
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
    expect((await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false })).exitCode).toBe(0);
    expect(existsSync(join(directory.path, 'owned.txt'))).toBe(false);
    expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
});
