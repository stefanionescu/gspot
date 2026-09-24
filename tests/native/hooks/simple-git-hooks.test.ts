import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation, hookStatus } from '#cli/lifecycle/hooks.ts';
import { installHookManager } from '#cli/lifecycle/hook-managers.ts';
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const POLICY = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "simple-git-hooks"\n';

test.each(['', "apps/worker's tools"])(
    'native simple-git-hooks preserves commands and restores policy directory %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        await createFileTree(root, {
            'gspot.toml': POLICY,
            'package.json':
                JSON.stringify(
                    {
                        private: true,
                        devDependencies: { 'simple-git-hooks': '2.13.1' },
                        'simple-git-hooks': {
                            'pre-push': `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'original.js'))} "$@"`,
                        },
                    },
                    null,
                    2,
                ) + '\n',
            'original.js':
                'await Bun.write("package-input", await Bun.stdin.text()); await Bun.write("package-args", JSON.stringify(process.argv.slice(2)));',
            'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('gspot-input', await Bun.stdin.text()); await Bun.write('gspot-args', JSON.stringify(process.argv.slice(2))); process.exitCode = (await Bun.file('failed').exists()) ? 1 : 0;\n`,
        });
        chmodSync(join(root, 'bin/gspot'), 0o755);
        expect((await run(['git', 'init', '-q', sandbox.path], { cwd: root })).code).toBe(0);
        const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: root,
            timeoutMs: 60_000,
        });
        expect(installed.code, installed.stderr).toBe(0);
        const originalManifest = readFileSync(join(root, 'package.json'), 'utf8');
        const location = hookLocation(root);
        const originalHook = '#!/bin/sh\ncat > local-input\nprintf "%s\\n" "$@" > local-args\n';
        writeFileSync(join(location.absolute, 'pre-push'), originalHook, { mode: 0o755 });
        expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
        const manifest = readFileSync(join(root, 'package.json'), 'utf8');
        expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
        await installHookManager(await openSession(root));
        const hook = readFileSync(join(location.absolute, 'pre-push'), 'utf8');
        await installHookManager(await openSession(root));
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(hook);
        expect(hookStatus(await openSession(root)).ready).toBe(true);
        const managerPath = join(location.absolute, 'pre-push.gspot-manager');
        const manager = readFileSync(managerPath);
        unlinkSync(managerPath);
        const missingManager = hookStatus(await openSession(root));
        expect(missingManager.ready).toBe(false);
        expect(missingManager.text).toContain('pre-push.gspot-manager');
        writeFileSync(managerPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        expect(hookStatus(await openSession(root)).ready).toBe(false);
        writeFileSync(managerPath, manager);
        if (process.platform !== 'win32') {
            chmodSync(managerPath, 0o644);
            expect(hookStatus(await openSession(root)).ready).toBe(false);
            chmodSync(managerPath, 0o755);
        }
        expect(hookStatus(await openSession(root)).ready).toBe(true);
        const input = 'refs/heads/main a refs/heads/main b\nrefs/heads/other c refs/heads/other d\n';
        writeFileSync(join(root, 'push-input'), input);
        const args = [
            'git',
            'hook',
            'run',
            '--to-stdin',
            join(root, 'push-input'),
            'pre-push',
            '--',
            'origin',
            'remote with spaces',
        ];
        const env = { PATH: `${join(root, 'bin')}:${process.env['PATH'] ?? ''}` };
        const checked = await run(args, { cwd: root, env });
        expect(checked.code, checked.stderr).toBe(0);
        for (const path of ['local-input', 'package-input', 'gspot-input'])
            expect(readFileSync(join(path === 'gspot-input' ? root : sandbox.path, path), 'utf8')).toBe(input);
        expect(JSON.parse(readFileSync(join(sandbox.path, 'package-args'), 'utf8'))).toStrictEqual([
            'origin',
            'remote with spaces',
        ]);
        expect(JSON.parse(readFileSync(join(root, 'gspot-args'), 'utf8'))).toStrictEqual([
            'check',
            '--push',
            '--',
            'origin',
            'remote with spaces',
        ]);
        writeFileSync(join(root, 'failed'), 'finding');
        expect((await run(args, { cwd: root, env })).code).toBe(1);
        expect((await run(args, { cwd: root, env: { ...env, SKIP_SIMPLE_GIT_HOOKS: '1' } })).code).toBe(1);
        const rc = join(root, 'hook-init.sh');
        for (const [body, status, calls] of [
            ['exit 0\n', 1, 'x'],
            ['exec true\n', 1, 'x'],
            ['cat > rc-input\n', 1, 'x'],
            ['set -e\nfalse\n', 1, ''],
            ['exit 7\n', 7, ''],
        ] as const) {
            writeFileSync(rc, body);
            writeFileSync(join(root, 'gspot-runs'), '');
            const result = await run(args, { cwd: root, env: { ...env, SIMPLE_GIT_HOOKS_RC: rc } });
            expect(result.code, result.stdout + result.stderr).toBe(status);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
            if (calls !== '') {
                expect(readFileSync(join(root, 'gspot-input'), 'utf8')).toBe(input);
                expect(JSON.parse(readFileSync(join(root, 'gspot-args'), 'utf8'))).toStrictEqual([
                    'check',
                    '--push',
                    '--',
                    'origin',
                    'remote with spaces',
                ]);
            }
        }
        expect((await uninstallCommand({ cwd: root, yes: true, isDryRun: false })).exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(originalManifest);
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(originalHook);
        expect(existsSync(join(location.absolute, 'pre-push.gspot-manager'))).toBe(false);
        expect(existsSync(join(root, '.gspot/integrations/simple-git-hooks/pre-push'))).toBe(false);
    },
    90_000,
);

test('simple-git-hooks configuration coexists with generated npm scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY + '[runner]\ntool = "npm"\n',
        'package.json': '{"private":true,"scripts":{"authored":"echo keep"}}\n',
    });
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const manifest = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8'));
    expect(manifest.scripts.authored).toBe('echo keep');
    expect(manifest.scripts['gspot:check']).toBe('gspot check');
    expect(manifest['simple-git-hooks']['pre-commit']).toContain('.gspot/integrations/simple-git-hooks/pre-commit');
});

test('an overriding simple-git-hooks file remains intact and refuses package integration', async () => {
    await using sandbox = await testdir();
    const original = 'module.exports = { "pre-commit": "echo keep" };\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'package.json': '{"private":true}\n',
        '.simple-git-hooks.cjs': original,
    });
    await expect(applyCommand({ cwd: sandbox.path, isDryRun: false })).rejects.toThrow(
        'Retained .simple-git-hooks.cjs',
    );
    expect(readFileSync(join(sandbox.path, '.simple-git-hooks.cjs'), 'utf8')).toBe(original);
    expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe('{"private":true}\n');
});
