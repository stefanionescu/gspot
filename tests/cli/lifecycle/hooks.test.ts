// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { rm, chmod } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import * as processes from '#cli/platform/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { installCommand } from '#cli/commands/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { readGitSetting } from '#cli/platform/git/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { openSession, applyCommand } from '#cli/commands/public.ts';
import { HOOK_REPOSITORIES } from '#tests/config/cli/lifecycle/hooks.ts';
import { hookStatus, installHooks } from '#cli/lifecycle/install/contracts.ts';

// The policy and repository of a session: what install and doctor both read.

async function hooksOf(root: string) {
    const session = await openSession(root);
    return { policy: session.policyFiles.policy, repository: session.repository };
}

test.each([...HOOK_REPOSITORIES])(
    'a repository with $name keeps its hooks and gets the lines to add',
    async ({ name: _kind, files, setting, gitHook }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { tables: 'runner = "npm"\n[hooks]\nenabled = true\n' }),
            ...files,
        });
        gitOutput(sandbox.path, ['init', '-q']);
        if (setting !== undefined) gitOutput(sandbox.path, [...setting]);
        if (gitHook) await Bun.write(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
        const before = readGitSetting(sandbox.path, 'core.hooksPath');
        const authoredPaths = gitHook ? ['.git/hooks/pre-commit'] : Object.keys(files);
        const authored = await Promise.all(
            authoredPaths.map(async (path) => ({ path, content: await Bun.file(join(sandbox.path, path)).text() })),
        );
        {
            using log = openOwnership(sandbox.path);
            const session = await openSession(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }
        const preview = await installCommand({ cwd: sandbox.path, isDryRun: true });
        expect(preview.exitCode).toBe(0);
        expect(preview.json).toMatchObject({ dryRun: true });
        const plan = preview.json as InstallJson;
        expect(plan.steps!.some(([command]) => command === 'git')).toBe(false);
        expect(preview.json).not.toHaveProperty('hooks');
        const text = installHooks(await hooksOf(sandbox.path));
        expect(plan.notes).toContain(text);
        expect(text).toContain('add these gspot lines to them');
        expect(text).toContain('pre-commit: npm exec --no -- gspot check --hook pre-commit');
        expect(text).toContain('pre-push: npm exec --no -- gspot check --hook pre-push -- "$@"');
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
        for (const { path, content } of authored) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
        expect(hookStatus(await hooksOf(sandbox.path))).toStrictEqual({ ready: false, text: `not installed; ${text}` });
        const [first] = authored;
        expect(first).toBeDefined();
        await Bun.write(
            join(sandbox.path, first!.path),
            `${first!.content}\nnpm exec --no -- gspot check --hook pre-commit\n`,
        );
        expect(hookStatus(await hooksOf(sandbox.path))).toMatchObject({ ready: true });
    },
);

test('a policy without hooks installs none', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], {}) });
    gitOutput(sandbox.path, ['init', '-q']);
    expect(installHooks(await hooksOf(sandbox.path))).toBe('');
    expect(hookStatus(await hooksOf(sandbox.path))).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

// The hook is a POSIX shell script that a POSIX PATH runs directly.
test.skipIf(!isPosix).each(['missing', 'not executable'])(
    'an installed hook reports setup failure when its gspot launcher is %s',
    async (condition) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': buildPolicy([], { tables: '[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n' }),
            'bin/gspot': '#!/bin/sh\nexit 0\n',
        });
        gitOutput(repository.path, ['init', '-q']);
        {
            using log = openOwnership(repository.path);
            const session = await openSession(repository.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }
        const launcher = join(repository.path, 'bin/gspot');
        await (condition === 'missing' ? rm(launcher) : chmod(launcher, 0o644));
        const hook = join(repository.path, '.gspot/hooks/pre-commit');
        const options = {
            cwd: repository.path,
            env: { PATH: `${join(repository.path, 'bin')}${delimiter}/usr/bin${delimiter}/bin` },
        };
        const failed = await processes.run([hook], options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toContain('gspot install');
    },
);

test.each(['', 'app/'])('disabling hooks prunes %s.gspot/hooks and leaves unsetting Git to install', async (prefix) => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, prefix);
    const policy = buildPolicy([], { tables: '[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n' });
    await createFileTree(root, { 'gspot.toml': policy });
    gitOutput(sandbox.path, ['init', '-q']);
    expect(await applyCommand({ cwd: root, isDryRun: false })).toHaveProperty('exitCode', 0);
    installHooks(await hooksOf(root));
    const ownPath = `${prefix}.gspot/hooks`;
    expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const hook = join(root, '.gspot/hooks/pre-commit');
    const installed = await Bun.file(hook).text();
    await Bun.write(join(root, 'gspot.toml'), policy.replace('enabled = true', 'enabled = false'));
    const preview = await applyCommand({ cwd: root, isDryRun: true });
    expect(preview.exitCode).toBe(0);
    expect((preview.json as ApplyPlanJson).drift).toContainEqual({ path: '.gspot/hooks/pre-commit', kind: 'stray' });
    expect(await Bun.file(hook).text()).toBe(installed);
    const removed = await applyCommand({ cwd: root, isDryRun: false });
    expect(removed.exitCode).toBe(0);
    expect(await pathExists(hook)).toBe(false);
    expect(removed.text).toContain('Run: gspot install');
    expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    const installPreview = await installCommand({ cwd: root, isDryRun: true });
    expect(installPreview.exitCode).toBe(0);
    expect((installPreview.json as InstallJson).steps).toContainEqual(['git', 'config', '--unset', 'core.hooksPath']);
    expect(readGitSetting(root, 'core.hooksPath')).toBe(ownPath);
    installHooks(await hooksOf(root));
    expect(readGitSetting(root, 'core.hooksPath')).toBeUndefined();
    gitOutput(root, ['config', 'core.hooksPath', '.githooks']);
    expect(installHooks(await hooksOf(root))).toBe('');
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});

test('a nested repository reads foreign hooks from the native Git hooks directory', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'app');
    const hook = join(sandbox.path, '.githooks/pre-commit');
    await createFileTree(sandbox.path, {
        'app/gspot.toml': buildPolicy([], { tables: '[hooks]\nenabled = true\n' }),
        '.githooks/pre-commit': '#!/bin/sh\ngspot check --hook pre-commit\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    const context = await hooksOf(root);
    expect(hookStatus(context).ready).toBe(true);
    await Bun.write(hook, '#!/bin/sh\nexit 0\n');
    const absent = hookStatus(context);
    expect(absent.ready).toBe(false);
    expect(absent.text).toContain('gspot check --hook pre-commit');
    expect(readGitSetting(root, 'core.hooksPath')).toBe('.githooks');
});
