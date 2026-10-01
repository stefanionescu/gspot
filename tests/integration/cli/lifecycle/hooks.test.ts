// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { readGitSetting } from '#cli/repository/git-config.ts';
import { hookStatus, installHooks } from '#cli/lifecycle/hooks.ts';

// The policy and repository of a session: what install and doctor both read.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every case reads the hooks state again after a change, through a new session like a new gspot run.
async function hooksOf(root: string) {
    const session = await openSession(root);
    return { policy: session.policyFiles.policy, repository: session.repository };
}

test.each(['', 'app/'])('install points core.hooksPath at %s.gspot/hooks', async (prefix) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${prefix}gspot.toml`]: policyOf([], '[hooks]\n') });
    gitOutput(sandbox.path, ['init', '-q']);
    const root = join(sandbox.path, prefix);
    expect(hookStatus(await hooksOf(root))).toStrictEqual({ ready: false, text: 'not installed; run gspot install' });
    expect(installHooks(await hooksOf(root))).toBe(`installed hooks: core.hooksPath is ${prefix}.gspot/hooks`);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(`${prefix}.gspot/hooks`);
    expect(hookStatus(await hooksOf(root))).toStrictEqual({ ready: true, text: `${prefix}.gspot/hooks: installed` });
});

test.each([
    ['another hooks folder', { '.githooks/pre-commit': '#!/bin/sh\n' }, ['config', 'core.hooksPath', '.githooks']],
    ['a Husky folder', { '.husky/pre-commit': 'npm test\n' }, undefined],
    ['a Lefthook configuration', { 'lefthook.yml': 'pre-commit:\n' }, undefined],
    ['a script in the Git hooks folder', {}, undefined],
] as const)('a repository with %s keeps its hooks and gets the lines to add', async (_kind, files, setting) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], '[hooks]\n[runner]\ntool = "npm"\n'), ...files });
    gitOutput(sandbox.path, ['init', '-q']);
    if (setting !== undefined) gitOutput(sandbox.path, [...setting]);
    if (Object.keys(files).length === 0)
        await Bun.write(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
    const before = readGitSetting(sandbox.path, 'core.hooksPath');
    const text = installHooks(await hooksOf(sandbox.path));
    expect(text).toContain('add these gspot lines to them');
    expect(text).toContain('pre-commit: npm exec --no -- gspot check --staged');
    expect(text).toContain('pre-push: npm exec --no -- gspot check --push -- "$@"');
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
    expect(hookStatus(await hooksOf(sandbox.path))).toMatchObject({ ready: true });
});

test('a policy without hooks installs none', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], '') });
    gitOutput(sandbox.path, ['init', '-q']);
    expect(installHooks(await hooksOf(sandbox.path))).toBe('');
    expect(hookStatus(await hooksOf(sandbox.path))).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});
