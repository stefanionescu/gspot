import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/lifecycle/hooks/location.ts';
import type { HookCapture } from '#tests/support/cli/reports.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { hookReadiness, installManager } from '#tests/support/cli/hooks.ts';

import {
    chmodSync,
    existsSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    unlinkSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';

// Lefthook's own helper is repaired on install, an edit to it is refused, and a missing one is not ready.
async function expectHelperRepairs(
    root: string,
    helperPath: string,
    originalHelper: Buffer<ArrayBuffer>,
): Promise<void> {
    const repaired = readFileSync(helperPath);
    expect(repaired).not.toStrictEqual(originalHelper);
    writeFileSync(helperPath, '#!/bin/sh\nexit 0\n');
    expect(await hookReadiness(root)).toBe(false);
    expect(await rejection(installManager(root))).toContain('Retained edited hook');
    expect(readFileSync(helperPath, 'utf8')).toBe('#!/bin/sh\nexit 0\n');
    writeFileSync(helperPath, repaired);
    unlinkSync(helperPath);
    expect(await hookReadiness(root)).toBe(false);
    writeFileSync(helperPath, repaired, { mode: 0o755 });
    expect(await hookReadiness(root)).toBe(true);
}

test.each(['custom', 'native'])(
    'native Lefthook preserves a %s hook and delivers exact Git input',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        await createFileTree(root, {
            'scratch/.keep': '',
            'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "lefthook"\n',
            'package.json': '{"private":true,"devDependencies":{"lefthook":"2.0.13"}}\n',
            'hook-settings.yml': 'rc: ./hook-init.sh\n',
            'hook-init.sh': 'export GSPOT_FIXTURE_RC=retained\nprintf "%s" "$GSPOT_FIXTURE_RC" > rc-ran\n',
            'lefthook.yml':
                '# Authored hook\nextends: [hook-settings.yml]\npre-push:\n  commands:\n    authored:\n      run: echo retained\n',
            'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('captured.json', JSON.stringify({args:process.argv.slice(2), input:process.argv.includes('--push') ? await Bun.stdin.text() : ''})); process.exitCode = await Bun.file('setup-failed').exists() ? 2 : await Bun.file('failed').exists() ? 1 : 0;\n`,
        });
        chmodSync(join(root, 'bin/gspot'), 0o755);
        const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: root,
            timeoutMs: 60_000,
        });
        expect(installed.code, installed.stderr).toBe(0);
        const initialized = await run(['git', 'init', '--quiet'], { cwd: root });
        expect(initialized.code, initialized.stderr).toBe(0);
        writeFileSync(join(root, 'source.txt'), 'fixture\n');
        for (const command of [
            ['git', 'add', 'source.txt'],
            ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
        ]) {
            const result = await run(command, { cwd: root });
            expect(result.code, result.stderr).toBe(0);
        }

        const applied = await applyCommand({ cwd: root, isDryRun: false });
        expect(applied.exitCode).toBe(0);
        const configuration = readFileSync(join(root, 'lefthook.yml'), 'utf8');
        expect(configuration).toContain('# Authored hook');
        expect(configuration).toContain('echo retained');
        const command = [
            join(root, 'node_modules/.bin/lefthook'),
            'run',
            'pre-push',
            'origin',
            'remote',
            '--command',
            'gspot',
            '--force',
            '--no-auto-install',
            '--no-tty',
        ];
        const input = 'refs/heads/main a refs/heads/main b\nrefs/heads/other c refs/heads/other d\n';
        const options = {
            cwd: root,
            stdin: input,
            timeoutMs: 5000,
            env: {
                TMPDIR: join(root, 'scratch'),
                PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GSPOT_LEFTHOOK_REMOTE_NAME: 'origin',
                GSPOT_LEFTHOOK_REMOTE_LOCATION: 'remote',
            },
        };
        const checked = await run(command, options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toStrictEqual({
            args: ['check', '--push', '--', 'origin', 'remote'],
            input,
        });
        await Bun.write(join(root, 'failed'), 'finding');
        const failed = await run(command, options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(readFileSync(join(root, 'lefthook.yml'), 'utf8')).toBe(configuration);
        const location = hookLocation(root);
        const prepared =
            existing === 'native'
                ? await run([join(root, 'node_modules/.bin/lefthook'), 'install'], options)
                : undefined;
        expect(prepared?.code ?? 0, (prepared?.stdout ?? '') + (prepared?.stderr ?? '')).toBe(0);
        if (existing !== 'native') {
            writeFileSync(join(location.absolute, 'pre-commit'), '#!/bin/sh\nprintf retained > original-ran\n', {
                mode: 0o755,
            });
        }
        if (existing === 'custom')
            writeFileSync(join(location.absolute, 'prepare-commit-msg'), '#!/bin/sh\nprintf retained > helper-ran\n', {
                mode: 0o755,
            });
        const original = readFileSync(join(location.absolute, 'pre-commit'), 'utf8');
        const helperPath = join(location.absolute, 'prepare-commit-msg');
        const originalHelper = existsSync(helperPath) ? readFileSync(helperPath) : undefined;
        writeFileSync(join(root, 'hook-settings.yml'), 'pre-commit: [invalid yaml\n');
        expect(await rejection(installManager(root))).toContain('Cannot load Lefthook configuration');
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init.sh\n');
        const offline = await run(
            [
                process.execPath,
                '-e',
                `import { installHookManager } from ${JSON.stringify(join(import.meta.dir, '../../../../packages/cli/src/lifecycle/hooks/managers.ts'))}; import { openSession } from ${JSON.stringify(join(import.meta.dir, '../../../../packages/cli/src/execution/session.ts'))}; const session = await openSession(${JSON.stringify(root)}); await installHookManager({ policy: session.policyFiles.policy, repository: session.repository, tools: session });`,
            ],
            {
                cwd: root,
                timeoutMs: 10_000,
                env: { HTTPS_PROXY: 'http://127.0.0.1:1', HTTP_PROXY: 'http://127.0.0.1:1', NO_PROXY: '' },
            },
        );
        expect(offline.code, offline.stdout + offline.stderr).toBe(0);
        const dispatcher = readFileSync(join(location.absolute, 'pre-commit'));
        writeFileSync(join(root, 'hook-init-updated.sh'), 'printf updated > rc-ran\n');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init-updated.sh\n');
        await installManager(root);
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
        expect(await hookReadiness(root)).toBe(true);
        if (existing === 'native' && originalHelper !== undefined)
            await expectHelperRepairs(root, helperPath, originalHelper);
        const staged = await run(['git', 'add', 'gspot.toml'], { cwd: root });
        expect(staged.code).toBe(0);
        unlinkSync(join(root, 'failed'));
        writeFileSync(join(root, 'gspot-runs'), '');
        const native = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        // The retained custom hook ran beside gspot; a native installation had no such hook.
        const originalRan = join(root, 'original-ran');
        expect(existsSync(originalRan) ? readFileSync(originalRan, 'utf8') : undefined).toBe(
            existing === 'custom' ? 'retained' : undefined,
        );
        expect(readFileSync(join(root, 'rc-ran'), 'utf8')).toBe('updated');
        expect((JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8')) as HookCapture).args).toStrictEqual([
            'check',
            '--staged',
        ]);
        const changedAt = new Date(Date.now() + 2000);
        utimesSync(join(root, 'lefthook.yml'), changedAt, changedAt);
        const committed = await run(
            [
                'git',
                '-c',
                'user.name=Fixture',
                '-c',
                'user.email=fixture@example.test',
                'commit',
                '-qm',
                'test: native hook',
            ],
            { ...options, stdin: '' },
        );
        expect(committed.code, committed.stdout + committed.stderr).toBe(0);
        // The custom helper is kept and ran; a native helper is Lefthook's own.
        const helperRan = join(root, 'helper-ran');
        expect(existsSync(helperRan) ? readFileSync(helperRan, 'utf8') : undefined).toBe(
            existing === 'custom' ? 'retained' : undefined,
        );
        expect(readFileSync(helperPath, 'utf8') === '#!/bin/sh\nprintf retained > helper-ran\n').toBe(
            existing === 'custom',
        );
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
        writeFileSync(join(root, 'failed'), 'finding');
        const messagePath = 'message with spaces "quotes" $dollar `literal`';
        writeFileSync(join(root, messagePath), 'test: fixture\n');
        const message = await run(['git', 'hook', 'run', 'commit-msg', '--', messagePath], { ...options, stdin: '' });
        expect(message.code, message.stdout + message.stderr).toBe(1);
        expect((JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8')) as HookCapture).args).toStrictEqual([
            'check',
            '--stage',
            'message',
            '--message-file',
            messagePath,
        ]);
        expect(message.stderr).not.toContain('command not found');
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(root, 'push-input'), input);
        const pushed = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            {
                ...options,
                stdin: '',
            },
        );
        expect(pushed.code, pushed.stdout + pushed.stderr).toBe(1);
        expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toStrictEqual({
            args: ['check', '--push', '--', 'origin', remote],
            input,
        });
        expect(pushed.stderr).not.toContain('command not found');
        unlinkSync(join(root, 'failed'));
        const corrected = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            { ...options, stdin: '' },
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readFileSync(join(root, 'lefthook.yml'), 'utf8')).toBe(configuration);
        for (const [body, code, calls] of [
            ['exit 0', 1, 'x'],
            ['exec true', 1, 'x'],
            ['cat > rc-input\nexit 0', 1, 'x'],
            ['exit 7', 7, ''],
            ['set -e\nfalse', 1, ''],
        ] as const) {
            writeFileSync(join(root, 'hook-init-updated.sh'), `${body}\n`);
            writeFileSync(join(root, 'failed'), 'finding');
            writeFileSync(join(root, 'gspot-runs'), '');
            rmSync(join(root, 'captured.json'), { force: true });
            const initialized = await run(
                ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
                { ...options, stdin: '' },
            );
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(code);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
            // A run that reached gspot captured the push input and arguments; a failed init left nothing.
            const capturedPath = join(root, 'captured.json');
            expect(existsSync(capturedPath) ? JSON.parse(readFileSync(capturedPath, 'utf8')) : undefined).toStrictEqual(
                calls === '' ? undefined : { args: ['check', '--push', '--', 'origin', remote], input },
            );
            expect(readdirSync(join(root, 'scratch'))).toStrictEqual(['.keep']);
        }
        expect(readFileSync(join(root, 'rc-input'), 'utf8')).toBe(input);
        writeFileSync(join(root, 'hook-init-updated.sh'), 'printf updated > rc-ran\n');
        unlinkSync(join(root, 'failed'));
        writeFileSync(join(root, 'setup-failed'), 'missing tool');
        const setupFailure = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(setupFailure.code, setupFailure.stdout + setupFailure.stderr).toBe(2);
        unlinkSync(join(root, 'setup-failed'));
        const reset = await run(['git', 'reset', '--quiet'], { cwd: root });
        expect(reset.code).toBe(0);
        writeFileSync(join(root, 'gspot-runs'), '');
        writeFileSync(join(root, 'failed'), 'finding');
        const emptyIndex = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(emptyIndex.code, emptyIndex.stdout + emptyIndex.stderr).toBe(1);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        unlinkSync(join(root, 'failed'));
        const hooked = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(hooked.code).toBe(0);
        const current = await run(['git', 'branch', '--show-current'], { cwd: root });
        const branch = current.stdout.trim();
        for (const command of [
            ['git', 'remote', 'add', 'origin', '.'],
            ['git', 'update-ref', `refs/remotes/origin/${branch}`, 'HEAD'],
            ['git', 'branch', '--set-upstream-to', `origin/${branch}`],
        ]) {
            const result = await run(command, { cwd: root });
            expect(result.code, result.stderr).toBe(0);
        }
        writeFileSync(join(root, 'gspot-runs'), '');
        writeFileSync(join(root, 'failed'), 'finding');
        const skipped = await run(
            [
                join(root, 'node_modules/.bin/lefthook'),
                'run',
                'pre-push',
                'origin',
                'remote',
                '--no-auto-install',
                '--no-tty',
            ],
            options,
        );
        expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('');
        const unchangedPush = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            { ...options, stdin: '' },
        );
        expect(unchangedPush.code, unchangedPush.stdout + unchangedPush.stderr).toBe(1);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toStrictEqual({
            args: ['check', '--push', '--', 'origin', remote],
            input,
        });
        writeFileSync(join(root, 'hook-settings.yml'), 'pre-commit: [invalid yaml\n');
        const malformed = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('gspot install');
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init-updated.sh\n');
        const executable = join(root, 'node_modules/.bin/lefthook');
        renameSync(executable, `${executable}.retained`);
        try {
            const unavailable = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
            expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
            expect(unavailable.stderr).toContain('gspot install');
        } finally {
            renameSync(`${executable}.retained`, executable);
        }
        expect(readdirSync(join(root, 'scratch'))).toStrictEqual(['.keep']);

        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
        const hooksPath = await run(['git', 'config', '--get', 'core.hooksPath'], { cwd: root });
        expect(hooksPath.code).toBe(1);
        const uninstalled = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        expect(existsSync(join(location.absolute, 'pre-commit.gspot-manager'))).toBe(false);
        // Uninstall puts the native helper back and removes the one gspot created.
        expect(existsSync(helperPath) ? readFileSync(helperPath) : undefined).toStrictEqual(originalHelper);
    },
    60_000,
);

test('Lefthook versions without the supported installation controls retain existing hooks', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "lefthook"\n',
        'package.json': '{"private":true,"devDependencies":{"lefthook":"1.11.13"}}\n',
    });
    for (const command of [
        ['git', 'init', '--quiet'],
        ['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
    ]) {
        const result = await run(command, { cwd: repository.path, timeoutMs: 60_000 });
        expect(result.code, result.stderr).toBe(0);
    }
    const location = hookLocation(repository.path);
    const original = '#!/bin/sh\necho authored\n';
    writeFileSync(join(location.absolute, 'pre-commit'), original, { mode: 0o755 });
    const applied = await applyCommand({ cwd: repository.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await rejection(installManager(repository.path))).toContain('Install Lefthook 2.0.13 or newer');
    expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
    expect(existsSync(join(location.absolute, 'pre-commit.gspot-manager'))).toBe(false);
}, 60_000);
