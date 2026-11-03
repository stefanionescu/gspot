import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { captureRejection } from '#tests/setup/matchers.ts';
import { utimes, readFile, writeFile } from 'node:fs/promises';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readDefaultRef, readTreeStatus, readChangedPaths } from '#cli/repository/revisions/changes.ts';

test('the status of an unborn index lists its staged, unstaged, and untracked paths', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n', 'notes.txt': 'draft\n' });

    runGitStep(sandbox.path, ['add', 'source.ts']);
    expect(await readTreeStatus(sandbox.path)).toStrictEqual({
        staged: ['source.ts'],
        unstaged: [],
        untracked: { paths: ['notes.txt'], unreadablePaths: [] },
        hasStagedChanges: true,
    });
    await writeFile(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    const { unstaged } = await readTreeStatus(sandbox.path);
    expect(unstaged).toStrictEqual(['source.ts']);
});

test('a status read leaves the index of a stat-dirty tree unwritten', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    const index = join(sandbox.path, '.git', 'index');
    const written = await readFile(index);
    await utimes(join(sandbox.path, 'source.ts'), new Date(0), new Date(0));
    const { unstaged } = await readTreeStatus(sandbox.path);
    expect(unstaged).toStrictEqual([]);
    expect(await readFile(index)).toStrictEqual(written);
});

test('staged and branch comparisons keep deleted paths', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['rm', 'source.ts']);
    const removed = await readTreeStatus(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
});

test('staged and branch comparisons keep both paths of a rename across folders', async () => {
    await using sandbox = await testdir({ 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    const moved = await readTreeStatus(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
});

test('a status read reports a broken or missing Git repository instead of an empty status', async () => {
    await using sandbox = await testdir();
    const error = await captureRejection(readTreeStatus(sandbox.path));
    expect(error.message).toStartWith('Git status failed');
    runGitStep(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    const statusError = await captureRejection(readTreeStatus(sandbox.path));
    expect(statusError.message).toStartWith('Git status failed');
});

test('a branch comparison refuses invalid references without reading them as options', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    const error = await captureRejection(readChangedPaths(sandbox.path, 'missing-reference'));
    expect(error.message).toContain('missing-reference is not a branch, tag, or commit in this repository.');
    expect(error.message).toContain('Local branches:');
    const mergeBaseError = await captureRejection(readChangedPaths(sandbox.path, '--output=outside.txt'));
    expect(mergeBaseError.message).toContain(
        '--output=outside.txt is not a branch, tag, or commit in this repository.',
    );
    expect(existsSync(join(sandbox.path, 'outside.txt'))).toBe(false);
    const blob = runGitStep(sandbox.path, ['rev-parse', 'HEAD:source.ts']);
    const blobError = await captureRejection(readChangedPaths(sandbox.path, blob));
    expect(blobError.message).toContain(`${blob} is not a branch, tag, or commit in this repository.`);
});

test('a new branch compares with the remote default without losing unpushed commits', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Published']);
    const published = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', published]);
    runGitStep(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    runGitStep(sandbox.path, ['checkout', '-qb', 'topic']);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await readPushedCommits(sandbox.path)).toStrictEqual([runGitStep(sandbox.path, ['rev-parse', 'HEAD'])]);
    const compared = await readDefaultRef(sandbox.path);
    expect(compared).toBe('refs/remotes/origin/main');
    const { commits } = await readChangedPaths(sandbox.path, compared);
    expect(commits).toStrictEqual([runGitStep(sandbox.path, ['rev-parse', 'HEAD'])]);
});

test('a branch comparison includes untracked files but excludes ignored files', async () => {
    await using sandbox = await testdir({ '.gitignore': 'ignored.ts\n', 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'new.ts'), 'export const added = 1;\n');
    await writeFile(join(sandbox.path, 'ignored.ts'), 'export const ignored = 1;\n');
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['new.ts']);
});

test('without an upstream or origin/HEAD, the default branch is origin/main, then origin/master', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['checkout', '--detach', '--quiet']);
    expect(await readDefaultRef(sandbox.path)).toBe('');
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/master', 'HEAD']);
    expect(await readDefaultRef(sandbox.path)).toBe('refs/remotes/origin/master');
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    expect(await readDefaultRef(sandbox.path)).toBe('refs/remotes/origin/main');
});

test('an unknown base in a shallow clone says that the clone is shallow and how deep to fetch', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    runGitStep(sandbox.path, ['init', '-q', '-b', 'main', source]);
    await writeFile(join(source, 'source.ts'), 'export {};\n');
    commitAll(source);
    await writeFile(join(source, 'source.ts'), 'export const changed = 1;\n');
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '-q', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const error = await captureRejection(readChangedPaths(join(sandbox.path, 'checkout'), 'HEAD~1'));
    expect(error.message).toBe(
        'HEAD~1 is not a branch, tag, or commit in this repository. Local branches: main. This clone is shallow and lacks older commits. Fetch the full history with git fetch --unshallow, or set the fetch depth of the checkout to 0.',
    );
});
