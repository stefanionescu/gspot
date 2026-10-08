// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { rm, chmod } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { hookStatus, installHooks } from '#cli/lifecycle/hooks-path.ts';
import { HOOK_REPOSITORIES } from '#tests/config/cli/lifecycle/hooks.ts';

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
            writeGeneratedFiles(await openSession(sandbox.path), log);
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
            writeGeneratedFiles(await openSession(repository.path), log);
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
