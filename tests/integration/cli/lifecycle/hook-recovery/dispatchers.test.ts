import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { hookStatusText } from '#tests/support/cli/hooks.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import type { HookCapture } from '#tests/support/cli/reports.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { chmodSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';

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
        if (kind === 'external') await createFileTree(external.path, { "author's hooks/.keep": '' });
        const configured =
            kind === 'external'
                ? await processes.run(['git', 'config', 'core.hooksPath', join(external.path, "author's hooks")], {
                      cwd: root,
                  })
                : undefined;
        expect(configured?.code ?? 0, configured?.stderr).toBe(0);
        if (kind === 'worktree') root = join(external.path, "linked author's tree");
        const added =
            kind === 'worktree'
                ? await processes.run(['git', 'worktree', 'add', '--detach', root, 'HEAD'], { cwd: sandbox.path })
                : undefined;
        expect(added?.code ?? 0, added?.stderr).toBe(0);
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
        const editedDispatcher = readFileSync(join(directory, 'pre-commit'), 'utf8') + '# authored addition\n';
        writeFileSync(join(directory, 'pre-commit'), editedDispatcher);
        expect(await hookStatusText(root)).toContain('missing or edited pre-commit');
        const removed = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(readFileSync(join(directory, 'pre-commit'), 'utf8')).toBe(editedDispatcher);
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(editedOriginal);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(editedOriginal);
        expect(readFileSync(join(sandbox.path, '.git/config'))).toStrictEqual(config);
    },
);
