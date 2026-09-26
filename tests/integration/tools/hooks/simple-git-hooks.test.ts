import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { SIMPLE_GIT_HOOKS_POLICY } from '#tests/constants/integration/tools/hooks.ts';
import { hookReadiness, hookStatusText, installManager } from '#tests/support/cli/hooks.ts';
import { chmodSync, existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';

const captured = (root: string, name: string) =>
    existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : undefined;

test.each(['', "apps/worker's tools"])(
    'native simple-git-hooks preserves commands and restores policy directory %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        await createFileTree(root, {
            'gspot.toml': SIMPLE_GIT_HOOKS_POLICY,
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
        const ran = await run(['git', 'init', '-q', sandbox.path], { cwd: root });
        expect(ran.code).toBe(0);
        const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: root,
            timeoutMs: 60_000,
        });
        expect(installed.code, installed.stderr).toBe(0);
        const originalManifest = readFileSync(join(root, 'package.json'), 'utf8');
        const location = hookLocation(root);
        const originalHook = '#!/bin/sh\ncat > local-input\nprintf "%s\\n" "$@" > local-args\n';
        writeFileSync(join(location.absolute, 'pre-push'), originalHook, { mode: 0o755 });
        const applied = await applyCommand({ cwd: root, isDryRun: false });
        expect(applied.exitCode).toBe(0);
        const manifest = readFileSync(join(root, 'package.json'), 'utf8');
        const reapplied = await applyCommand({ cwd: root, isDryRun: false });
        expect(reapplied.exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
        await installManager(root);
        const hook = readFileSync(join(location.absolute, 'pre-push'), 'utf8');
        await installManager(root);
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(hook);
        expect(await hookReadiness(root)).toBe(true);
        const managerPath = join(location.absolute, 'pre-push.gspot-manager');
        const manager = readFileSync(managerPath);
        unlinkSync(managerPath);
        expect(await hookReadiness(root)).toBe(false);
        expect(await hookStatusText(root)).toContain('pre-push.gspot-manager');
        writeFileSync(managerPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        expect(await hookReadiness(root)).toBe(false);
        writeFileSync(managerPath, manager);
        // A manager file that lost its executable bit is not ready; Windows has no such bit to lose.
        if (process.platform !== 'win32') chmodSync(managerPath, 0o644);
        const unexecutable = await hookReadiness(root);
        expect(unexecutable).toBe(process.platform === 'win32');
        chmodSync(managerPath, 0o755);
        expect(await hookReadiness(root)).toBe(true);
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
        const env = { PATH: `${join(root, 'bin')}:${environmentVariables()['PATH'] ?? ''}` };
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
        const failed = await run(args, { cwd: root, env });
        expect(failed.code).toBe(1);
        const skippedManager = await run(args, { cwd: root, env: { ...env, SKIP_SIMPLE_GIT_HOOKS: '1' } });
        expect(skippedManager.code).toBe(1);
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
            for (const capture of ['gspot-input', 'gspot-args']) rmSync(join(root, capture), { force: true });
            const result = await run(args, { cwd: root, env: { ...env, SIMPLE_GIT_HOOKS_RC: rc } });
            expect(result.code, result.stdout + result.stderr).toBe(status);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
            // A run that reached gspot handed it the push input and the arguments; one that did not left no capture.
            expect(captured(root, 'gspot-input')).toBe(calls === '' ? undefined : input);
            expect(captured(root, 'gspot-args')).toBe(
                calls === '' ? undefined : JSON.stringify(['check', '--push', '--', 'origin', 'remote with spaces']),
            );
        }
        const uninstalled = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(originalManifest);
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(originalHook);
        expect(existsSync(join(location.absolute, 'pre-push.gspot-manager'))).toBe(false);
        expect(existsSync(join(root, '.gspot/integrations/simple-git-hooks/pre-push'))).toBe(false);
    },
    90_000,
);
