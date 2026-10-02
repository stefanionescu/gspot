import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { existsSync, writeFileSync } from 'node:fs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pushBase, stagedFiles, changedFiles } from '#cli/repository/revisions/changes.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every git step of these tests runs and asserts success the same way.
function git(root: string, ...argv: string[]): void {
    const result = runBlocking(['git', ...argv], { cwd: root });
    expect(result.code, result.stderr).toBe(0);
}

function commit(root: string): void {
    git(root, 'init');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Sandbox');
}

test('Git change read > reports an unborn index and its unstaged edits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    git(sandbox.path, 'init');
    git(sandbox.path, 'add', 'source.ts');
    expect(await stagedFiles(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
    writeFileSync(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    expect(await stagedFiles(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
});

test('Git change read > keeps deletion paths in staged and reference comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commit(sandbox.path);
    git(sandbox.path, 'rm', 'source.ts');
    const removed = await stagedFiles(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await changedFiles(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
});

test('Git change read > keeps both paths of a rename across directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
    commit(sandbox.path);
    git(sandbox.path, 'mv', 'api/source.ts', 'web/source.ts');
    const moved = await stagedFiles(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await changedFiles(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
});

test('Git change read > reports corrupt or absent Git state instead of an empty staged set', async () => {
    await using sandbox = await testdir();
    expect(await rejection(stagedFiles(sandbox.path))).toContain('Git diff failed');
    git(sandbox.path, 'init');
    writeFileSync(join(sandbox.path, '.git/index'), 'corrupt index');
    expect(await rejection(stagedFiles(sandbox.path))).toContain('Git diff failed');
});

test('Git change read > rejects invalid reference reads without interpreting options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commit(sandbox.path);
    const changed = await changedFiles(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    expect(await rejection(changedFiles(sandbox.path, 'missing-reference'))).toContain('Git merge-base failed');
    expect(await rejection(changedFiles(sandbox.path, '--output=outside.txt'))).toContain('Git merge-base failed');
    expect(existsSync(join(sandbox.path, 'outside.txt'))).toBe(false);
});
test('Git change read > push comparison distinguishes an absent upstream from a missing upstream object', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commit(sandbox.path);
    const first = await pushBase(sandbox.path);
    git(sandbox.path, 'branch', 'upstream');
    git(sandbox.path, 'branch', '--set-upstream-to=upstream');
    await Bun.write(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    git(sandbox.path, 'add', '.');
    git(sandbox.path, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Second');
    expect(await pushBase(sandbox.path)).toBe(first);
    git(sandbox.path, 'update-ref', '-d', 'refs/heads/upstream');
    expect(await rejection(pushBase(sandbox.path))).toContain('Git merge-base failed');
});

test('Git change read > push comparison reports an unborn or corrupt HEAD instead of inventing a base', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    git(sandbox.path, 'init');
    expect(await rejection(pushBase(sandbox.path))).toContain('Git rev-parse failed');
    commit(sandbox.path);
    writeFileSync(join(sandbox.path, '.git/HEAD'), 'broken head');
    expect(await rejection(pushBase(sandbox.path))).toContain('Git rev-parse failed');
});

test('Git change read > a new branch compares with the remote default without losing unpublished commits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commit(sandbox.path);
    git(
        sandbox.path,
        '-c',
        'user.name=Sandbox',
        '-c',
        'user.email=sandbox@example.com',
        'commit',
        '--allow-empty',
        '-qm',
        'Published',
    );
    const published = runBlocking(['git', 'rev-parse', 'HEAD'], { cwd: sandbox.path }).stdout.trim();
    git(sandbox.path, 'update-ref', 'refs/remotes/origin/main', published);
    git(sandbox.path, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    git(sandbox.path, 'checkout', '-qb', 'topic');
    git(
        sandbox.path,
        '-c',
        'user.name=Sandbox',
        '-c',
        'user.email=sandbox@example.com',
        'commit',
        '--allow-empty',
        '-qm',
        'Unpublished',
    );
    expect(await pushBase(sandbox.path)).toBe(published);
    const { reference, commits } = await changedFiles(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
    // Only the unpublished commit is new after the remote default, so only its message is checked.
    expect(commits).toStrictEqual([runBlocking(['git', 'rev-parse', 'HEAD'], { cwd: sandbox.path }).stdout.trim()]);
    git(sandbox.path, 'branch', 'upstream', 'HEAD');
    git(sandbox.path, 'branch', '--set-upstream-to=upstream');
    expect(await pushBase(sandbox.path)).not.toBe(published);
});
