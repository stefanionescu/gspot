import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { readStagedPaths, readChangedPaths } from '#cli/repository/revisions/changes.ts';

test('staged paths of an unborn index count its unstaged edits', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['init']);
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
    expect(await captureRejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
    runGitStep(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    expect(await captureRejection(readStagedPaths(sandbox.path))).toContain('Git diff failed');
});
test('a branch comparison refuses invalid references without reading them as options', async () => {
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
test('a new branch compares with the remote default without losing unpushed commits', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Published']);
    const published = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', published]);
    runGitStep(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    runGitStep(sandbox.path, ['checkout', '-qb', 'topic']);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await readPushedCommits(sandbox.path, undefined)).toStrictEqual([
        runGitStep(sandbox.path, ['rev-parse', 'HEAD']),
    ]);
    const { reference, commits } = await readChangedPaths(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
    // The comparison returns the commit identifier of the unpublished commit after the remote default.
    expect(commits).toStrictEqual([runGitStep(sandbox.path, ['rev-parse', 'HEAD'])]);
});
