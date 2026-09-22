import { fileURLToPath } from 'node:url';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { join, delimiter } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { expect, spyOn, test } from 'bun:test';
import { MISE_MIN_VERSION } from '#cli/emit/runner-tasks.ts';
import { uninstallCommand } from '#cli/lifecycle/uninstall-command.ts';
import { hookLocation, hookStatus } from '#cli/lifecycle/hooks.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { openSession } from '#cli/run/session.ts';
import { existsSync, readFileSync, symlinkSync, chmodSync, writeFileSync, statSync, rmSync } from 'node:fs';
import * as processes from '#cli/platform/spawn.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';
import { installCommand } from '#cli/lifecycle/install-command.ts';

test.each([undefined, 'custom-hooks'])(
    'apply preserves Git and package configuration without integrations (%s)',
    async (hooksPath) => {
        const packageText = '{"private":true,"scripts":{"prepare":"build-app","check":"check-app"}}';
        const hookText = '#!/bin/sh\nprintf app-hook\n';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
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
        expect(readFileSync(configPath)).toEqual(originalConfig);
        expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe(packageText);
        expect(readFileSync(join(sandbox.path, 'custom-hooks/pre-commit'), 'utf8')).toBe(hookText);
        expect(existsSync(join(sandbox.path, '.gspot/hooks'))).toBe(false);
        expect(existsSync(join(sandbox.path, '.github/workflows/gspot.yml'))).toBe(false);
    },
);

test('a hooks integration outside Git does not create hook files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    await applyAll(await openSession(sandbox.path));
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    expect(existsSync(join(sandbox.path, '.gspot/hooks'))).toBe(false);
});

test('omitting hooks preserves existing managed hook files and their Git location', async () => {
    const hook = '#!/bin/sh\nprintf kept-hook\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
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
    expect(readFileSync(join(sandbox.path, '.git/config'))).toEqual(config);
});

test('apply refuses a proposal whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = 'version = 1\npresets = []\n[rules]\ninstall = false\n';
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = initial.replace('version = 1', 'version = 1\nlevel = "all"');
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    await expect(applyAll(session)).rejects.toThrow('changed after generation was planned');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/ownership.json'))).toBe(false);
});

test('an npm runner preserves the authored prepare command while adding explicit check scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[runner]\ntool = "bun"\n[rules]\ninstall = false\n',
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    await applyAll(await openSession(sandbox.path));
    const content = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
    };
    expect(content.scripts['prepare']).toBe('build-app');
    expect(content.scripts['check']).toBe('gspot check');
    expect(content.scripts['apply']).toBe('gspot apply');
});

test.each(['missing', 'outdated', 'download-failed'] as const)(
    'init preserves a usable configuration when mise is %s and install reports the remaining work',
    async (availability) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        const run = processes.run;
        const installer = spyOn(processes, 'run').mockImplementation((command, options) =>
            command[0] === 'mise'
                ? Promise.resolve({
                      code:
                          availability === 'missing'
                              ? 127
                              : availability === 'download-failed' && command[1] === 'install'
                                ? 1
                                : 0,
                      missing: availability === 'missing',
                      duration: 0,
                      stdout: availability === 'outdated' ? 'mise 2020.1.1' : `mise ${MISE_MIN_VERSION}`,
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
                presets: ['none'],
                hooks: 'none',
                ci: 'none',
                runner: 'mise',
                rules: 'no',
                install: true,
                allowDirty: true,
            });
            expect(result.exitCode).toBe(0);
            expect(result.text).toContain('tool installation is incomplete');
            expect(result.text).toContain('Run: gspot install');
            expect((await openSession(sandbox.path)).policyFiles.policy.presets).toEqual([]);
            expect(readFileSync(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
            const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(retry.exitCode).toBe(1);
            expect(retry.text).toContain(
                availability === 'download-failed' ? 'installation command mise install failed' : 'Install mise',
            );
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
                presets: ['python'],
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
            presets: ['spelling'],
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
    await createFileTree(sandbox.path, { 'typos.toml': authored, '.gspot/typos.toml': conflict });
    await expect(
        initCommand({
            cwd: sandbox.path,
            yes: true,
            isDryRun: false,
            json: true,
            presets: ['spelling'],
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
    expect(readFileSync(join(sandbox.path, '.gspot/typos.toml'), 'utf8')).toBe(conflict);
});

test.each(['default', 'external', 'worktree'] as const)(
    'installed dispatchers preserve executable hooks, input, status, and originals in %s Git locations',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await using launcher = await testdir();
        const policy = 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n';
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
        expect(readFileSync(hook)).toEqual(before);
        await applyAll(await openSession(root));
        expect(readFileSync(hook)).toEqual(before);
        for (let attempt = 0; attempt < 2; attempt++) {
            const installed = await installCommand({ cwd: root, isDryRun: false });
            expect(installed.exitCode, installed.text).toBe(0);
        }
        expect(readFileSync(join(sandbox.path, '.git/config'))).toEqual(config);
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
        expect(first.args).toEqual(['remote name', 'ssh://example.com/a b']);
        expect(second.args).toEqual(['check', '--push', '--', 'remote name', 'ssh://example.com/a b']);
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
        expect(hookStatus(await openSession(root))).toContain('missing or edited pre-commit');
        const removed = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(readFileSync(join(directory, 'pre-commit'), 'utf8')).toBe(editedDispatcher);
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(editedOriginal);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(editedOriginal);
        expect(readFileSync(join(sandbox.path, '.git/config'))).toEqual(config);
    },
);

test('hook sibling collisions refuse the whole installation before another hook is changed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const directory = hookLocation(sandbox.path).absolute;
    writeFileSync(join(directory, 'pre-push.gspot-original'), 'authored sibling');
    const refused = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(refused.exitCode).toBe(1);
    expect(refused.text).toContain('Hook sibling already exists');
    expect(existsSync(join(directory, 'pre-commit'))).toBe(false);
    expect(readFileSync(join(directory, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
});

test.each(['before', 'after'] as const)(
    'hook installation recovers interruption %s dispatcher publication',
    async (point) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        });
        expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
        const location = hookLocation(sandbox.path);
        const hook = join(location.absolute, 'pre-push');
        const original = '#!/bin/sh\nexit 0\n';
        writeFileSync(hook, original, { mode: 0o751 });
        const boundary = fileURLToPath(new URL('../../src/lifecycle/confined.ts', import.meta.url));
        const installer = fileURLToPath(new URL('../../src/lifecycle/install-command.ts', import.meta.url));
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
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const location = hookLocation(sandbox.path);
    const owner = openLifecycleOwner(location.root);
    try {
        const rejected = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(rejected.exitCode).toBe(1);
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        owner.close();
    }
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
});

test('a symbolic hook directory cannot redirect lifecycle writes outside its Git-resolved parent', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    await createFileTree(outside.path, { 'pre-commit': '#!/bin/sh\nexit 17\n' });
    symlinkSync(outside.path, join(sandbox.path, 'linked-hooks'));
    for (const args of [
        ['init', '-q'],
        ['config', 'core.hooksPath', 'linked-hooks'],
    ])
        expect((await processes.run(['git', ...args], { cwd: sandbox.path })).code).toBe(0);
    const rejected = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(rejected.exitCode).toBe(1);
    expect(readFileSync(join(outside.path, 'pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 17\n');
    expect(existsSync(join(outside.path, 'pre-push'))).toBe(false);
});

test('uninstall recovers after restoring an original hook and before removing its retained sibling', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const location = hookLocation(sandbox.path);
    const hook = join(location.absolute, 'pre-push');
    const original = '#!/bin/sh\nexit 0\n';
    writeFileSync(hook, original, { mode: 0o751 });
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const boundary = fileURLToPath(new URL('../../src/lifecycle/confined.ts', import.meta.url));
    const uninstall = fileURLToPath(new URL('../../src/lifecycle/uninstall-command.ts', import.meta.url));
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
