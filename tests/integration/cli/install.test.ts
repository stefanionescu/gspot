import { fileURLToPath } from 'node:url';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { applyAll } from '#cli/lifecycle/apply.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { join, delimiter, relative } from 'node:path';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { installCommand } from '#cli/commands/install.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { MISE_MIN_VERSION } from '#cli/emit/runner-tasks.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { hookLocation, hookStatus, installHooks } from '#cli/lifecycle/hooks.ts';
import { existsSync, readFileSync, symlinkSync, chmodSync, writeFileSync, statSync, rmSync } from 'node:fs';

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
        installHooks(await openSession(directory.path));
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
        installHooks(await openSession(root));
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
        if (kind === 'external') {
            await createFileTree(external.path, { 'hooks/.keep': '' });
            expect(
                processes.runBlocking(['git', 'config', 'core.hooksPath', join(external.path, 'hooks')], {
                    cwd: sandbox.path,
                }).code,
            ).toBe(0);
        }
        const location = hookLocation(root);
        const hook = join(location.absolute, 'pre-commit');
        const original = '#!/bin/sh\nprintf private-original\n';
        writeFileSync(hook, original, { mode: 0o751 });
        installHooks(await openSession(root));
        const installed = readFileSync(hook);
        const entry = readOwnership(location.root, location.stateDirectory).files.find(
            (file) => file.path === `${location.directory}/pre-commit`,
        )!;
        const backup = join(location.root, entry.original!.backup);
        writeFileSync(hook, '#!/bin/sh\nprintf later-edit\n');
        const conflict = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(conflict.json).toMatchObject({
            preserved: expect.arrayContaining([relative(root, hook)]),
            originals: expect.arrayContaining([{ path: hook, backup }]),
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
        if (hooksPath !== undefined) {
            const configured = await processes.run(['git', 'config', 'core.hooksPath', hooksPath], {
                cwd: sandbox.path,
            });
            expect(configured.code, configured.stderr).toBe(0);
        }
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
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
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

test('apply refuses a proposal whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = initial.replace('version = 1', 'version = 1\nlevel = "all"');
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    await expect(applyAll(session)).rejects.toThrow('changed after generation was planned');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('an npm runner preserves the authored prepare command while adding explicit check scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[runner]\ntool = "bun"\n[rules]\ninstall = false\n',
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    await applyAll(await openSession(sandbox.path));
    const content = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
    };
    expect(content.scripts['prepare']).toBe('build-app');
    expect(content.scripts['gspot:check']).toBe('gspot check');
    expect(content.scripts['gspot:apply']).toBe('gspot apply');
});

test.each(['missing', 'outdated', 'download-failed'] as const)(
    'init preserves a usable configuration when mise is %s and install reports the remaining work',
    async (availability) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        const run = processes.run;
        let isRepaired = false;
        const installer = spyOn(processes, 'run').mockImplementation((command, options) =>
            command[0] === 'mise'
                ? Promise.resolve({
                      code:
                          !isRepaired && availability === 'missing'
                              ? 127
                              : !isRepaired && availability === 'download-failed' && command[1] === 'install'
                                ? 1
                                : 0,
                      missing: !isRepaired && availability === 'missing',
                      duration: 0,
                      stdout: !isRepaired && availability === 'outdated' ? 'mise 2020.1.1' : `mise ${MISE_MIN_VERSION}`,
                      stderr: '',
                  })
                : run(command, options),
        );
        try {
            const result = await initCommand({
                cwd: sandbox.path,
                yes: true,
                isDryRun: false,
                json: true,
                configurations: ['none'],
                hooks: 'none',
                ci: 'none',
                runner: 'mise',
                rules: 'no',
                install: true,
                allowDirty: true,
            });
            expect(result.exitCode).toBe(2);
            expect(result.text).toContain('tool installation is incomplete');
            expect(result.text).toContain('Run: gspot install');
            expect((await openSession(sandbox.path)).policyFiles.policy.configurations).toStrictEqual([]);
            expect(readFileSync(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
            const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(retry.exitCode).toBe(2);
            expect(retry.text).toContain(
                availability === 'download-failed' ? 'installation command mise install failed' : 'Install mise',
            );
            const policy = readFileSync(join(sandbox.path, 'gspot.toml'));
            isRepaired = true;
            const repaired = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(repaired.exitCode, repaired.text).toBe(0);
            expect(readFileSync(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
            expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
        } finally {
            installer.mockRestore();
        }
    },
);

test('init does not report success when required Python lock resolution cannot run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'main.py': 'print("authored")\n',
        'pyrightconfig.json': '{"exclude":["legacy"]}\n',
    });
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) =>
        command[0] === 'uv'
            ? Promise.resolve({ code: 127, missing: true, duration: 0, stdout: '', stderr: '' })
            : run(command, options),
    );
    try {
        await expect(
            initCommand({
                cwd: sandbox.path,
                yes: true,
                isDryRun: false,
                json: true,
                configurations: ['python'],
                isListExact: true,
                hooks: 'none',
                ci: 'none',
                runner: 'mise',
                rules: 'no',
                install: true,
                allowDirty: true,
            }),
        ).rejects.toThrow('Install uv');
        expect(readFileSync(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
        expect(existsSync(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'pyrightconfig.json'), 'utf8')).toBe('{"exclude":["legacy"]}\n');
    } finally {
        installer.mockRestore();
    }
});

test('init refuses an unsafe output ancestor before attempting installation', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'authored.toml': 'untouched = true\n' });
    await createFileTree(sandbox.path, { 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    symlinkSync(outside.path, join(sandbox.path, '.mise'));
    await expect(
        initCommand({
            cwd: sandbox.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['spelling'],
            isListExact: true,
            hooks: 'none',
            ci: 'none',
            runner: 'mise',
            rules: 'no',
            install: true,
            allowDirty: true,
        }),
    ).rejects.toThrow();
    expect(readFileSync(join(outside.path, 'authored.toml'), 'utf8')).toBe('untouched = true\n');
    expect(existsSync(join(outside.path, 'conf.d/gspot-tools.toml'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(
        '[default.extend-words]\nAuthored = "Authored"\n',
    );
});

test('init retains old configuration when a conflicting replacement cannot be published', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    const conflict = '# Maintained independently.\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored, '.gspot/config/typos.toml': conflict });
    await expect(
        initCommand({
            cwd: sandbox.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['spelling'],
            isListExact: true,
            hooks: 'none',
            ci: 'none',
            runner: 'none',
            rules: 'no',
            install: false,
            allowDirty: true,
        }),
    ).rejects.toThrow('Setup preserved conflicting outputs');
    expect(readFileSync(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
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
        expect(hookStatus(await openSession(root)).text).toContain('missing or edited pre-commit');
        const removed = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(readFileSync(join(directory, 'pre-commit'), 'utf8')).toBe(editedDispatcher);
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(editedOriginal);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(editedOriginal);
        expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
    },
);

test('hook sibling collisions refuse the whole installation before another hook is changed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const directory = hookLocation(sandbox.path).absolute;
    writeFileSync(join(directory, 'pre-push.gspot-original'), 'authored sibling');
    const refused = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(refused.exitCode).toBe(2);
    expect(refused.text).toContain('Hook sibling already exists');
    expect(existsSync(join(directory, 'pre-commit'))).toBe(false);
    expect(readFileSync(join(directory, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
});

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
        const boundary = fileURLToPath(new URL('../../../packages/cli/src/platform/filesystem.ts', import.meta.url));
        const installer = fileURLToPath(new URL('../../../packages/cli/src/commands/install.ts', import.meta.url));
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

test('a concurrent hook writer is refused and installation succeeds after its lock is released', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const location = hookLocation(sandbox.path);
    const owner = openLifecycleOwner(location.root);
    try {
        const rejected = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(rejected.exitCode).toBe(2);
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        owner.close();
    }
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
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
        ])
            expect((await processes.run(['git', ...args], { cwd: sandbox.path })).code).toBe(0);
        const session = await openSession(sandbox.path);
        symlinkSync(outside.path, join(sandbox.path, 'linked-hooks'));
        expect(() => installHooks(session)).toThrow(/Unsafe lifecycle/u);
        await rejects(installCommand({ cwd: sandbox.path, isDryRun: false }), {
            message: /Source link leaves the repository/u,
        });
        expect(readFileSync(join(outside.path, 'pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 17\n');
        expect(existsSync(join(outside.path, 'pre-push'))).toBe(false);
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
    const boundary = fileURLToPath(new URL('../../../packages/cli/src/platform/filesystem.ts', import.meta.url));
    const uninstall = fileURLToPath(new URL('../../../packages/cli/src/commands/uninstall.ts', import.meta.url));
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
    installHooks(session);
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
    installHooks(await openSession(root));
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
    installHooks(session);
    const boundary = sandbox.path;
    const backup = readOwnership(boundary).files.find((entry) => entry.path === 'custom/hooks/pre-commit')!.original!
        .backup;
    for (const path of ['.gspot/state/ownership.json', backup])
        expect(processes.runBlocking(['git', 'check-ignore', '--', path], { cwd: sandbox.path }).code).toBe(0);
    expect((await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false })).exitCode).toBe(0);
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
    expect(() => installHooks(session)).toThrow('Retained tracked hook');
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
    installHooks(await openSession(root));
    expect(readFileSync(join(root, 'pre-commit'), 'utf8')).toContain('check --staged');
    expect(hookStatus(await openSession(root)).text).toContain(': installed');
    const result = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(root, 'pre-commit'))).toBe(false);
});

test('a hook conflict reports inability while independent installer steps still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[runner]\ntool = "mise"\n[rules]\ninstall = false\n',
    });
    expect(processes.runBlocking(['git', 'init', '--quiet'], { cwd: sandbox.path }).code).toBe(0);
    const location = hookLocation(sandbox.path);
    writeFileSync(join(location.absolute, 'pre-push.gspot-original'), 'authored sibling');
    const observed: string[][] = [];
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise') return run(command, options);
        observed.push([...command]);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 0,
            stdout: `mise ${MISE_MIN_VERSION}`,
            stderr: '',
        });
    });
    try {
        const result = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(result.exitCode).toBe(2);
        expect(result.text).toContain('Hook sibling already exists');
        expect(observed).toContainEqual(['mise', 'install']);
        expect(readFileSync(join(location.absolute, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        installer.mockRestore();
    }
});

test.each(['missing', 'not executable'])(
    'an installed hook reports setup failure when its gspot launcher is %s',
    async (condition) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
            'bin/gspot': '#!/bin/sh\nexit 0\n',
        });
        expect((await processes.run(['git', 'init', '-q'], { cwd: repository.path })).code).toBe(0);
        installHooks(await openSession(repository.path));
        const launcher = join(repository.path, 'bin/gspot');
        if (condition === 'missing') rmSync(launcher);
        else chmodSync(launcher, 0o644);
        const hook = join(hookLocation(repository.path).absolute, 'pre-commit');
        const options = {
            cwd: repository.path,
            env: { PATH: `${join(repository.path, 'bin')}${delimiter}/usr/bin${delimiter}/bin` },
        };
        const failed = await processes.run([hook], options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toContain('gspot install');
        writeFileSync(launcher, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        chmodSync(launcher, 0o755);
        const corrected = await processes.run([hook], options);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
