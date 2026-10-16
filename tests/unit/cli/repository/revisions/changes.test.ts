import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

test('reports an unborn index and its unstaged edits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'source.ts']);
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
    await writeFile(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
});

test('keeps deleted paths in staged and branch comparisons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['rm', 'source.ts']);
    const removed = await readStagedPaths(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
});

test('keeps both paths of a rename across folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    const moved = await readStagedPaths(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
});

test('reports a broken or missing Git repository instead of an empty staged list', async () => {
    await using sandbox = await testdir();
    expect(await rejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
    gitOutput(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    expect(await rejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
});

test('refuses invalid references without reading them as options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    expect(await rejection(readChangedPaths(sandbox.path, 'missing-reference'))).toContain('Git merge-base failed');
    expect(await rejection(readChangedPaths(sandbox.path, '--output=outside.txt'))).toContain('Git merge-base failed');
    expect(await pathExists(join(sandbox.path, 'outside.txt'))).toBe(false);
});

test('push comparison tells a missing upstream from an upstream whose commit is gone', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-qm', 'Second']);
    gitOutput(sandbox.path, ['branch', 'upstream']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    gitOutput(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    expect(await rejection(readPushedCommits(sandbox.path, undefined))).toContain('Git merge-base failed');
});

test('push comparison reports an unborn or broken HEAD instead of inventing a base', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git/HEAD'), 'broken head');
    expect(await rejection(readPushedCommits(sandbox.path, undefined))).toContain('Cannot read committed Git history');
});

test('a new branch compares with the remote default without losing unpushed commits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Published']);
    const published = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', published]);
    gitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    gitOutput(sandbox.path, ['checkout', '-qb', 'topic']);
    gitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([
        gitOutput(sandbox.path, ['rev-parse', 'HEAD']),
    ]);
    const { reference, commits } = await readChangedPaths(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
    // The comparison returns the commit identifier of the unpublished commit after the remote default.
    expect(commits).toStrictEqual([gitOutput(sandbox.path, ['rev-parse', 'HEAD'])]);
});
