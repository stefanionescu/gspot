import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

test('reports an unborn index and its unstaged edits', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['add', 'source.ts']);
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
    await writeFile(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
});

test('keeps deleted paths in staged and branch comparisons', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    readGitOutput(sandbox.path, ['rm', 'source.ts']);
    const removed = await readStagedPaths(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
});

test('keeps both paths of a rename across folders', async () => {
    await using sandbox = await testdir({ 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });

    commitAll(sandbox.path);
    readGitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    const moved = await readStagedPaths(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
});

test('reports a broken or missing Git repository instead of an empty staged list', async () => {
    await using sandbox = await testdir();
    expect(await captureRejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
    readGitOutput(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    expect(await captureRejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
});

test('refuses invalid references without reading them as options', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    expect(await captureRejection(readChangedPaths(sandbox.path, 'missing-reference'))).toContain(
        'Git merge-base failed',
    );
    expect(await captureRejection(readChangedPaths(sandbox.path, '--output=outside.txt'))).toContain(
        'Git merge-base failed',
    );
    expect(await isOnDisk(join(sandbox.path, 'outside.txt'))).toBe(false);
});

test('push comparison tells a missing upstream from an upstream whose commit is gone', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    readGitOutput(sandbox.path, ['add', '.']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'Second']);
    readGitOutput(sandbox.path, ['branch', 'upstream']);
    readGitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    readGitOutput(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    expect(await captureRejection(readPushedCommits(sandbox.path, undefined))).toContain('Git merge-base failed');
});

test('push comparison reports an unborn or broken HEAD instead of inventing a base', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    readGitOutput(sandbox.path, ['init']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([]);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git/HEAD'), 'broken head');
    expect(await captureRejection(readPushedCommits(sandbox.path, undefined))).toContain(
        'Cannot read committed Git history',
    );
});

test('a new branch compares with the remote default without losing unpushed commits', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    readGitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Published']);
    const published = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', published]);
    readGitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    readGitOutput(sandbox.path, ['checkout', '-qb', 'topic']);
    readGitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([
        readGitOutput(sandbox.path, ['rev-parse', 'HEAD']),
    ]);
    const { reference, commits } = await readChangedPaths(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
    // The comparison returns the commit identifier of the unpublished commit after the remote default.
    expect(commits).toStrictEqual([readGitOutput(sandbox.path, ['rev-parse', 'HEAD'])]);
});
