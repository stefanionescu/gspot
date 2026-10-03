// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/platform/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { git, commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import { hookStatus, installHooks } from '#cli/lifecycle/hooks-path.ts';

// The folder of the gspot launcher, which a hook finds on the path.
const LAUNCHER = join(import.meta.dir, '../../../../scripts');

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
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], 'runner = "npm"\n[hooks]\n'), ...files });
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

test('a commit in a linked worktree runs the staged checks and blocks a defect', async () => {
    await using sandbox = await testdir();
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');
    const finder = [
        process.execPath,
        '-e',
        'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;',
        '{files}',
    ];
    const check = `[[check]]\nname = "sandbox/defect"\ncommand = ${JSON.stringify(finder)}\npaths = ["src/**"]\nstage = "commit"\n[check.output]\nformat = "lines"\n`;
    await createFileTree(main, {
        'gspot.toml': policyOf([], `[hooks]\n[rules]\ninstall = false\n${check}`),
        'src/kept.txt': 'clean\n',
    });
    commitAll(main);
    const applied = await runGspot(main, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    gitOutput(main, ['add', '-A']);
    gitOutput(main, ['commit', '-qm', 'Generated files']);
    gitOutput(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    const installed = await runGspot(linked, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const environment = { PATH: `${LAUNCHER}${delimiter}${environmentVariables()['PATH'] ?? ''}`, NO_COLOR: '1' };
    await Bun.write(join(linked, 'src/added.txt'), 'DEFECT\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const blocked = git(linked, ['commit', '-qm', 'Defect'], environment);
    expect(blocked.code, blocked.stdout + blocked.stderr).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('src/added.txt');
    await Bun.write(join(linked, 'src/added.txt'), 'clean\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const accepted = git(linked, ['commit', '-qm', 'Clean'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});
