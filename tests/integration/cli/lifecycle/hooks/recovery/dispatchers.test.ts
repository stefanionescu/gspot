import { join } from 'node:path';
import { testdir } from 'testdirs';
import { expect, test } from 'bun:test';
import * as processes from '#cli/platform/spawn.ts';
import type { HookCapture } from '#tests/types/cli.ts';
import { openSession } from '#cli/execution/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { readHookStatus } from '#tests/support/cli/hooks/projects.ts';
import { prepareDispatcher } from '#tests/support/cli/hooks/dispatchers.ts';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';

test.each(['default', 'external', 'worktree'] as const)(
    'dispatcher previews and repeated installation preserve original bytes, modes, and Git configuration in %s Git locations',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await using launcher = await testdir();
        const { root, directory, hook, original, config, before } = await prepareDispatcher(
            sandbox.path,
            external.path,
            launcher.path,
            kind,
        );
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
    },
);

test.each(['default', 'external', 'worktree'] as const)(
    'dispatchers forward exact input and stop when an authored hook fails in %s Git locations',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await using launcher = await testdir();
        const { root, hook, original, env } = await prepareDispatcher(sandbox.path, external.path, launcher.path, kind);
        await applyAll(await openSession(root));
        const installed = await installCommand({ cwd: root, isDryRun: false });
        expect(installed.exitCode, installed.text).toBe(0);
        const input = 'refs/heads/main abc refs/heads/main def\nrefs/tags/v1 ghi refs/tags/v1 jkl\n';
        const chained = await processes.run([hook, 'remote name', 'ssh://example.com/a b'], {
            cwd: root,
            env,
            stdin: input,
        });
        expect(chained.code, chained.stderr).toBe(0);
        const first = JSON.parse(readFileSync(join(root, 'original.json'), 'utf8')) as HookCapture;
        const second = JSON.parse(readFileSync(join(root, 'gspot.json'), 'utf8')) as HookCapture;
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
    },
);

test.each(['default', 'external', 'worktree'] as const)(
    'uninstall preserves edited dispatchers and restores authored hooks with their executable mode in %s Git locations',
    async (kind) => {
        await using sandbox = await testdir();
        await using external = await testdir();
        await using launcher = await testdir();
        const { root, directory, hook, original, config } = await prepareDispatcher(
            sandbox.path,
            external.path,
            launcher.path,
            kind,
        );
        await applyAll(await openSession(root));
        const installed = await installCommand({ cwd: root, isDryRun: false });
        expect(installed.exitCode, installed.text).toBe(0);
        const editedOriginal = original.replace('process.exit(0)', 'process.exit(19)');
        writeFileSync(`${hook}.gspot-original`, editedOriginal);
        const editedDispatcher = readFileSync(join(directory, 'pre-commit'), 'utf8') + '# authored addition\n';
        writeFileSync(join(directory, 'pre-commit'), editedDispatcher);
        expect(await readHookStatus(root)).toMatchObject({ text: textContaining('missing or edited pre-commit') });
        const removed = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(readFileSync(join(directory, 'pre-commit'), 'utf8')).toBe(editedDispatcher);
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(editedOriginal);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(editedOriginal);
        expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
    },
);
