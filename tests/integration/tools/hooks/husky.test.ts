import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import type { HookCapture } from '#tests/types/cli.ts';
import { rejection } from '#tests/support/expectations.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { rmSync, existsSync, unlinkSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { prepareHusky, readHookStatus, installHookTool } from '#tests/support/cli/hooks/projects.ts';

test.each(['default', 'native', 'nested'])(
    'Husky retains authored configuration across repeat installs and forwards exact push failures in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const { config, options } = await prepareHusky(root, top, kind);
        expect(await readHookStatus(root)).toMatchObject({ ready: false });
        for (let attempt = 0; attempt < 2; attempt++) await installHookTool(root);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
        expect(readFileSync(join(top, '.git/config'))).toStrictEqual(config);
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
            expect(JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8'))).toStrictEqual({
                args: ['check', '--push', '--', 'origin', remote],
                input,
            });
            expect(readFileSync(join(top, 'authored-input'), 'utf8')).toBe(input);
            expect(readFileSync(join(top, 'authored-args'), 'utf8')).toBe(`origin\n${remote}\n`);
            // The local hook that gspot preserved beside its own still receives the push input.
            const localInput = join(top, 'local-input');
            expect(existsSync(localInput) ? readFileSync(localInput, 'utf8') : undefined).toBe(
                kind === 'native' ? undefined : input,
            );
        }
    },
    60_000,
);
test.each(['default', 'native', 'nested'])(
    'Husky retains enforcement across authored exits and attempts to mask its status in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const { authored, options } = await prepareHusky(root, top, kind);
        await installHookTool(root);
        const input = 'refs/heads/main a refs/heads/main b\nrefs/tags/v1 c refs/tags/v1 d\n';
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(top, 'push-input'), input);
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
            rmSync(join(root, 'captured.json'), { force: true });
            const result = await run(
                ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
                options,
            );
            expect(result.code, result.stdout + result.stderr).toBe(status);
            expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe(calls);
            // A run that reached gspot captured the push input and arguments; a failed authored step left nothing.
            const capturedPath = join(root, 'captured.json');
            expect(existsSync(capturedPath) ? JSON.parse(readFileSync(capturedPath, 'utf8')) : undefined).toStrictEqual(
                calls === '' ? undefined : { args: ['check', '--push', '--', 'origin', remote], input },
            );
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
    },
    60_000,
);
test.each(['default', 'native', 'nested'])(
    'Husky reports a missing integration and accepts its restoration in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const { options } = await prepareHusky(root, top, kind);
        await installHookTool(root);
        const input = 'refs/heads/main a refs/heads/main b\nrefs/tags/v1 c refs/tags/v1 d\n';
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(top, 'push-input'), input);
        const managed = readFileSync(join(root, '.husky/pre-push'), 'utf8');
        unlinkSync(join(root, '.husky/pre-push'));
        expect(await readHookStatus(root)).toMatchObject({ ready: false });
        const missing = await run(
            ['git', 'hook', 'run', '--to-stdin', 'push-input', 'pre-push', '--', 'origin', remote],
            options,
        );
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(missing.stderr).toContain('gspot apply');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        await installHookTool(root);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
    },
    60_000,
);
test.each(['default', 'native', 'nested'])(
    'Husky refuses edited integration bodies and duplicate ownership markers in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        await prepareHusky(root, top, kind);
        await installHookTool(root);
        const managed = readFileSync(join(root, '.husky/pre-push'), 'utf8');
        writeFileSync(join(root, '.husky/pre-push'), managed.replace('gspot_status=0', 'gspot_status=7'));
        expect(await readHookStatus(root)).toMatchObject({ ready: false });
        expect(await rejection(installHookTool(root))).toContain('integration is missing or edited');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        await installHookTool(root);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
        writeFileSync(
            join(root, '.husky/pre-push'),
            managed + '\n# >>> gspot managed >>>\nexit 0\n# <<< gspot managed <<<\n',
        );
        expect(await rejection(readHookStatus(root))).toContain('markers');
        expect(await rejection(installHookTool(root))).toContain('markers');
        writeFileSync(join(root, '.husky/pre-push'), managed);
        await installHookTool(root);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
    },
    60_000,
);
test.each(['default', 'native', 'nested'])(
    'Husky preserves init-script exit behavior without bypassing gspot in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const { options } = await prepareHusky(root, top, kind);
        await installHookTool(root);
        const input = 'refs/heads/main a refs/heads/main b\nrefs/tags/v1 c refs/tags/v1 d\n';
        const remote = 'remote with spaces "quotes" $dollar `literal`';
        writeFileSync(join(top, 'push-input'), input);
        writeFileSync(join(root, 'verdict'), '1');
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
    },
    60_000,
);
test.each(['default', 'native', 'nested'])(
    'Husky preserves message paths and restores authored hooks on uninstall in a %s installation',
    async (kind) => {
        await using repository = await testdir();
        const top = join(repository.path, "author's repository");
        const root = kind === 'nested' ? join(top, "apps/worker's tools") : top;
        const { authored, original, location, config, options } = await prepareHusky(root, top, kind);
        await installHookTool(root);
        writeFileSync(join(root, 'verdict'), '0');
        // Windows file names cannot hold a double quote.
        const commitText =
            process.platform === 'win32' ? "message with 'quotes' and spaces" : 'message with "quotes" and spaces';
        writeFileSync(join(top, commitText), 'test: fixture\n');
        writeFileSync(join(root, 'gspot-runs'), '');
        const checked = await run(['git', 'hook', 'run', 'commit-msg', '--', commitText], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        expect((JSON.parse(readFileSync(join(root, 'captured.json'), 'utf8')) as HookCapture).args).toStrictEqual([
            'check',
            '--stage',
            'message',
            '--message-file',
            join(top, commitText),
        ]);
        expect(readFileSync(join(top, 'initialized'), 'utf8')).toBe('initialized');
        expect(readdirSync(join(root, 'scratch'))).toStrictEqual(['.keep']);
        const uninstalled = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(location.absolute, 'pre-push'))).toStrictEqual(original);
        expect(readFileSync(join(root, '.husky/pre-push'), 'utf8')).toBe(authored);
        expect(existsSync(join(location.absolute, 'pre-push.gspot-manager'))).toBe(false);
        expect(readFileSync(join(top, '.git/config'))).toStrictEqual(config);
    },
    60_000,
);
test('Husky becomes ready again after switching the runner in both directions', async () => {
    await using repository = await testdir();
    const root = repository.path;
    await prepareHusky(root, root, 'default');
    await installHookTool(root);
    const policy = readFileSync(join(root, 'gspot.toml'), 'utf8');
    writeFileSync(join(root, 'gspot.toml'), policy + '\n[runner]\ntool = "mise"\n');
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await readHookStatus(root)).toMatchObject({ ready: false });
    await installHookTool(root);
    expect(await readHookStatus(root)).toMatchObject({ ready: true });
    writeFileSync(join(root, 'gspot.toml'), policy);
    const reapplied = await applyCommand({ cwd: root, isDryRun: false });
    expect(reapplied.exitCode).toBe(0);
    await installHookTool(root);
    expect(await readHookStatus(root)).toMatchObject({ ready: true });
}, 60_000);
