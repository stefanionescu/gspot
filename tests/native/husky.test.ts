import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/emit/apply-command.ts';
import { installHookManager } from '#cli/lifecycle/hook-managers.ts';
import { hookLocation, hookStatus } from '#cli/lifecycle/hooks.ts';
import { uninstallCommand } from '#cli/lifecycle/uninstall-command.ts';
import { openSession } from '#cli/run/session.ts';
import { run } from '#cli/platform/spawn.ts';

test.each(['default', 'native', 'nested'])(
    'Husky preserves authored hooks and exact Git input in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const authored = 'cat > authored-input\nprintf "%s\\n" "$@" > authored-args\nexit 0\n';
        await createFileTree(root, {
            'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n[hooks]\ntool = "husky"\n',
            'package.json': '{"private":true,"devDependencies":{"husky":"9.1.7"}}\n',
            '.husky/pre-commit': 'printf retained > authored-commit\nexit 0\n',
            '.husky/pre-push': authored,
            '.husky/commit-msg': 'printf "%s" "$1" > authored-message\ncd authored-cwd\nset -- changed\n',
            'scratch/.keep': '',
            'config/husky/init.sh': 'printf initialized > initialized\n',
            'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('captured.json', JSON.stringify({args:process.argv.slice(2), input:process.argv.includes('--push') ? await Bun.stdin.text() : ''})); process.exitCode = Number(await Bun.file('verdict').text());\n`,
            verdict: '0',
        });
        await createFileTree(top, { 'authored-cwd/.keep': '' });
        chmodSync(join(root, 'bin/gspot'), 0o755);
        expect((await run(['git', 'init', '-q'], { cwd: top })).code).toBe(0);
        const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: root,
            timeoutMs: 60_000,
        });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const options = {
            cwd: top,
            timeoutMs: 5000,
            env: {
                PATH: `${join(root, 'bin')}${delimiter}${process.env['PATH'] ?? ''}`,
                XDG_CONFIG_HOME: join(root, 'config'),
                TMPDIR: join(root, 'scratch'),
            },
        };
        if (kind === 'native') {
            const native = await run([join(root, 'node_modules/.bin/husky')], options);
            expect(native.code, native.stderr).toBe(0);
        }
        const location = hookLocation(root);
        const original =
            kind === 'native'
                ? readFileSync(join(location.absolute, 'pre-push'))
                : Buffer.from('#!/bin/sh\ncat > local-input\nexit 0\n');
        if (kind !== 'native') writeFileSync(join(location.absolute, 'pre-push'), original, { mode: 0o755 });
        const config = readFileSync(join(top, '.git/config'));
        expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
        expect(hookStatus(await openSession(root)).ready).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) await installHookManager(await openSession(root));
        expect(hookStatus(await openSession(root)).ready).toBe(true);
        expect(readFileSync(join(top, '.git/config'))).toEqual(config);
        const input = 'refs/heads/main a refs/heads/main b\nrefs/tags/v1 c refs/tags/v1 d\n';
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(top, 'push-input'), input);
        for (const verdict of [1, 2, 0]) {
            writeFileSync(join(root, 'verdict'), String(verdict));
            writeFileSync(join(root, 'gspot-runs'), '');
            const result = await run(
                ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
                options,
            );
            expect(result.code, result.stdout + result.stderr).toBe(verdict);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
            expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toEqual({
                args: ['check', '--push', '--', 'origin', remote],
                input,
            });
            expect(readFileSync(join(top, 'authored-input'), 'utf8')).toBe(input);
            expect(readFileSync(join(top, 'authored-args'), 'utf8')).toBe(`origin\n${remote}\n`);
            if (kind !== 'native') expect(readFileSync(join(top, 'local-input'), 'utf8')).toBe(input);
        }
        const managed = readFileSync(join(root, '.husky/pre-push'), 'utf8');
        for (const [body, status, calls] of [
            ['exec true\n', 1, 'x'],
            ['cat > authored-input\n', 1, 'x'],
            ['cd authored-cwd\nset -- changed changed\n', 1, 'x'],
            ['exit 7\n', 7, ''],
            ['set -e\nfalse\n', 1, ''],
        ] as const) {
            writeFileSync(join(root, '.husky/pre-push'), managed.replace(authored, body));
            writeFileSync(join(root, 'verdict'), '1');
            writeFileSync(join(root, 'gspot-runs'), '');
            const result = await run(
                ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
                options,
            );
            expect(result.code, result.stdout + result.stderr).toBe(status);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
            if (calls !== '')
                expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toEqual({
                    args: ['check', '--push', '--', 'origin', remote],
                    input,
                });
        }
        writeFileSync(join(root, '.husky/pre-push'), managed.replace(authored, 'set +e\n') + '\nexit 0\n');
        writeFileSync(join(root, 'gspot-runs'), '');
        const masked = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            options,
        );
        expect(masked.code, masked.stdout + masked.stderr).toBe(1);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        unlinkSync(join(root, '.husky/pre-push'));
        expect(hookStatus(await openSession(root)).ready).toBe(false);
        const missing = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            options,
        );
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(missing.stderr).toContain('gspot apply');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        writeFileSync(join(root, '.husky/pre-push'), managed.replace('gspot_status=0', 'gspot_status=7'));
        expect(hookStatus(await openSession(root)).ready).toBe(false);
        await expect(installHookManager(await openSession(root))).rejects.toThrow('integration is missing or edited');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        writeFileSync(
            join(root, '.husky/pre-push'),
            managed + '\n# >>> gspot managed >>>\nexit 0\n# <<< gspot managed <<<\n',
        );
        await expect(installHookManager(await openSession(root))).rejects.toThrow('markers');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        const init = join(root, 'config/husky/init.sh');
        for (const [body, status, calls] of [
            ['exit 0\n', 1, 'x'],
            ['exec true\n', 1, 'x'],
            ['HUSKY=0\n', 1, 'x'],
            ['exit 7\n', 7, ''],
            ['set -e\nfalse\n', 1, ''],
        ] as const) {
            writeFileSync(init, body);
            writeFileSync(join(root, 'gspot-runs'), '');
            const result = await run(
                ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
                options,
            );
            expect(result.code, result.stdout + result.stderr).toBe(status);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
        }
        writeFileSync(init, 'printf initialized > initialized\n');
        writeFileSync(join(root, 'verdict'), '0');
        const message = 'message with "quotes" and spaces';
        writeFileSync(join(top, message), 'test: fixture\n');
        writeFileSync(join(root, 'gspot-runs'), '');
        const checked = await run(['git', 'hook', 'run', 'commit-msg', '--', message], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8')).args).toEqual([
            'check',
            '--stage',
            'message',
            '--message-file',
            join(top, message),
        ]);
        expect(readFileSync(join(top, 'initialized'), 'utf8')).toBe('initialized');
        expect(readdirSync(join(root, 'scratch'))).toEqual(['.keep']);
        if (kind === 'default') {
            const policy = readFileSync(join(root, 'gspot.toml'), 'utf8');
            writeFileSync(join(root, 'gspot.toml'), policy + '\n[runner]\ntool = "mise"\n');
            expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
            expect(hookStatus(await openSession(root)).ready).toBe(false);
            await installHookManager(await openSession(root));
            expect(hookStatus(await openSession(root)).ready).toBe(true);
            writeFileSync(join(root, 'gspot.toml'), policy);
            expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
            await installHookManager(await openSession(root));
            expect(hookStatus(await openSession(root)).ready).toBe(true);
        }
        expect((await uninstallCommand({ cwd: root, yes: true, isDryRun: false })).exitCode).toBe(0);
        expect(readFileSync(join(location.absolute, 'pre-push'))).toEqual(original);
        expect(readFileSync(join(root, '.husky/pre-push'), 'utf8')).toBe(authored);
        expect(existsSync(join(location.absolute, 'pre-push.gspot-manager'))).toBe(false);
        expect(readFileSync(join(top, '.git/config'))).toEqual(config);
    },
    60_000,
);
