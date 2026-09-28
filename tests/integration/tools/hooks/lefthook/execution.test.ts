import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import type { HookCapture } from '#tests/types/cli.ts';
import { installHookTool } from '#tests/support/cli/hooks/projects.ts';
import { prepareLefthook } from '#tests/support/cli/hooks/lefthook.ts';
import { rmSync, existsSync, unlinkSync, utimesSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['custom', 'native'])(
    'Lefthook forwards direct push input and findings without editing authored configuration with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { configuration, command, input, options } = await prepareLefthook(root, existing);
        expect(configuration).toContain('# Authored hook');
        expect(configuration).toContain('echo retained');
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
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook preserves authored hooks and refreshed init settings during real commits with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { options, location, scriptPath } = await prepareLefthook(root, existing);
        await installHookTool(root);
        const dispatcher = readFileSync(join(location.absolute, 'pre-commit'));
        writeFileSync(join(root, 'hook-init-updated.sh'), 'printf updated > rc-ran\n');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init-updated.sh\n');
        await installHookTool(root);
        const staged = await run(['git', 'add', 'gspot.toml'], { cwd: root });
        expect(staged.code).toBe(0);
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
        const scriptRan = join(root, 'helper-ran');
        expect(existsSync(scriptRan) ? readFileSync(scriptRan, 'utf8') : undefined).toBe(
            existing === 'custom' ? 'retained' : undefined,
        );
        expect(readFileSync(scriptPath, 'utf8') === '#!/bin/sh\nprintf retained > helper-ran\n').toBe(
            existing === 'custom',
        );
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook delivers quoted message paths and exact push input through rejected and corrected checks with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { configuration, input, options } = await prepareLefthook(root, existing);
        await installHookTool(root);
        writeFileSync(join(root, 'failed'), 'finding');
        // Windows file names cannot hold a double quote.
        const commitFile =
            process.platform === 'win32'
                ? "message with spaces 'quotes' $dollar `literal`"
                : 'message with spaces "quotes" $dollar `literal`';
        writeFileSync(join(root, commitFile), 'test: fixture\n');
        const commitResult = await run(['git', 'hook', 'run', 'commit-msg', '--', commitFile], {
            ...options,
            stdin: '',
        });
        expect(commitResult.code, commitResult.stdout + commitResult.stderr).toBe(1);
        expect((JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8')) as HookCapture).args).toStrictEqual([
            'check',
            '--stage',
            'message',
            '--message-file',
            commitFile,
        ]);
        expect(commitResult.stderr).not.toContain('command not found');
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
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook init scripts preserve enforcement and clean temporary input with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { input, options } = await prepareLefthook(root, existing);
        await installHookTool(root);
        writeFileSync(join(root, 'hook-init-updated.sh'), 'printf updated > rc-ran\n');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init-updated.sh\n');
        await installHookTool(root);
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(root, 'push-input'), input);
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
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook distinguishes setup errors from findings even with an empty index with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { options } = await prepareLefthook(root, existing);
        await installHookTool(root);
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
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook dispatchers enforce checks when native unchanged-push selection skips them with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { input, options } = await prepareLefthook(root, existing);
        await installHookTool(root);
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(root, 'push-input'), input);
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
    },
    60_000,
);
