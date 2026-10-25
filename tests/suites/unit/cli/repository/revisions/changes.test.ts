import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

test('staged paths of an unborn index count its unstaged edits', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['add', 'source.ts']);
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
    await writeFile(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    expect(await readStagedPaths(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
});
test('staged and branch comparisons keep deleted paths', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['rm', 'source.ts']);
    const removed = await readStagedPaths(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
});
test('staged and branch comparisons keep both paths of a rename across folders', async () => {
    await using sandbox = await testdir({ 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    const moved = await readStagedPaths(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
});
test('staged paths report a broken or missing Git repository instead of an empty list', async () => {
    await using sandbox = await testdir();
    const error = await captureRejection(readStagedPaths(sandbox.path));
    expect(error.message).toStartWith('Git diff failed');
    runGitStep(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    const diffError = await captureRejection(readStagedPaths(sandbox.path));
    expect(diffError.message).toStartWith('Git diff failed');
});
test('a branch comparison refuses invalid references without reading them as options', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    const changed = await readChangedPaths(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    const error = await captureRejection(readChangedPaths(sandbox.path, 'missing-reference'));
    expect(error.message).toStartWith('Git merge-base failed');
    const mergeBaseError = await captureRejection(readChangedPaths(sandbox.path, '--output=outside.txt'));
    expect(mergeBaseError.message).toStartWith('Git merge-base failed');
    expect(await isOnDisk(join(sandbox.path, 'outside.txt'))).toBe(false);
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
    const { reference, commits } = await readChangedPaths(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
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

test('a detached comparison without a remote default explains how to select one', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGitStep(sandbox.path, ['checkout', '--detach', '--quiet']);
    const upstreamError = await captureRejection(readChangedPaths(sandbox.path, ''));
    expect(upstreamError.message).toBe(
        'No upstream or default branch is available. Run git remote set-head origin --auto once, or pass --changed <ref>.',
    );
});
