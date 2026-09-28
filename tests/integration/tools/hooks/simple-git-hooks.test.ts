import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { rmSync, chmodSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { readHookStatus, installHookTool, prepareSimpleGitHooks } from '#tests/support/cli/hooks/projects.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the complexity limit.
const captured = (root: string, name: string) =>
    existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : undefined;

test.each(['', "apps/worker's tools"])(
    'native simple-git-hooks detects missing, edited, and unexecutable manager files in %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        const { location } = await prepareSimpleGitHooks(root, sandbox.path);
        const manifest = readFileSync(join(root, 'package.json'), 'utf8');
        const reapplied = await applyCommand({ cwd: root, isDryRun: false });
        expect(reapplied.exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
        await installHookTool(root);
        const hook = readFileSync(join(location.absolute, 'pre-push'), 'utf8');
        await installHookTool(root);
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(hook);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
        const nativePath = join(location.absolute, 'pre-push.gspot-manager');
        const nativeScript = readFileSync(nativePath);
        unlinkSync(nativePath);
        expect(await readHookStatus(root)).toMatchObject({ ready: false });
        expect(await readHookStatus(root)).toMatchObject({ text: textContaining('pre-push.gspot-manager') });
        writeFileSync(nativePath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        expect(await readHookStatus(root)).toMatchObject({ ready: false });
        writeFileSync(nativePath, nativeScript);
        // A manager file that lost its executable bit is not ready; Windows has no such bit to lose.
        if (process.platform !== 'win32') chmodSync(nativePath, 0o644);
        const unexecutable = await readHookStatus(root);
        expect(unexecutable.ready).toBe(process.platform === 'win32');
        chmodSync(nativePath, 0o755);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
    },
    90_000,
);
test.each(['', "apps/worker's tools"])(
    'native simple-git-hooks preserves push input, failures, and authored restoration in %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        const { originalManifest, originalHook, location } = await prepareSimpleGitHooks(root, sandbox.path);
        await installHookTool(root);
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
        const env = { PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}` };
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
        const skippedScript = await run(args, { cwd: root, env: { ...env, SKIP_SIMPLE_GIT_HOOKS: '1' } });
        expect(skippedScript.code).toBe(1);
        const uninstalled = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(originalManifest);
        expect(readFileSync(join(location.absolute, 'pre-push'), 'utf8')).toBe(originalHook);
        expect(existsSync(join(location.absolute, 'pre-push.gspot-manager'))).toBe(false);
        expect(existsSync(join(root, '.gspot/integrations/simple-git-hooks/pre-push'))).toBe(false);
    },
    90_000,
);
test.each(['', "apps/worker's tools"])(
    'native simple-git-hooks retains gspot enforcement and rc exit behavior in %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        await prepareSimpleGitHooks(root, sandbox.path);
        await installHookTool(root);
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
        const env = { PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}` };
        writeFileSync(join(root, 'failed'), 'finding');
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
    },
    90_000,
);
