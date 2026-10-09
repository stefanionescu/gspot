import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { getStaged, getChanged, getPushBase } from '#cli/repository/revisions/public.ts';

const unbornIndex = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'source.ts']);
    expect(await getStaged(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
    await writeFile(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
    expect(await getStaged(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
};

const deletedPaths = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['rm', 'source.ts']);
    const removed = await getStaged(sandbox.path);
    expect(removed.staged).toStrictEqual(['source.ts']);
    const changed = await getChanged(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['source.ts']);
};

const renamedPaths = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    const moved = await getStaged(sandbox.path);
    expect(moved.staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
    const changed = await getChanged(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
};

const corruptState = async () => {
    await using sandbox = await testdir();
    expect(await rejection(getStaged(sandbox.path))).toContain('Git diff failed');
    gitOutput(sandbox.path, ['init']);
    await writeFile(join(sandbox.path, '.git/index'), 'corrupt index');
    expect(await rejection(getStaged(sandbox.path))).toContain('Git diff failed');
};

const invalidReference = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    const changed = await getChanged(sandbox.path, 'HEAD');
    expect(changed.paths).toStrictEqual([]);
    expect(await rejection(getChanged(sandbox.path, 'missing-reference'))).toContain('Git merge-base failed');
    expect(await rejection(getChanged(sandbox.path, '--output=outside.txt'))).toContain('Git merge-base failed');
    expect(await pathExists(join(sandbox.path, 'outside.txt'))).toBe(false);
};

const absentUpstream = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    const first = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    expect(await getPushBase(sandbox.path)).toBe(first);
    await Bun.write(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-qm', 'Second']);
    const second = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    gitOutput(sandbox.path, ['branch', 'upstream']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await getPushBase(sandbox.path)).toBe(second);
    gitOutput(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    expect(await rejection(getPushBase(sandbox.path))).toContain('Git merge-base failed');
};

const unbornHead = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    expect(await rejection(getPushBase(sandbox.path))).toContain('Git rev-parse failed');
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git/HEAD'), 'broken head');
    expect(await rejection(getPushBase(sandbox.path))).toContain('Git rev-parse failed');
};

const remoteBranch = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Published']);
    const published = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', published]);
    gitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    gitOutput(sandbox.path, ['checkout', '-qb', 'topic']);
    gitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await getPushBase(sandbox.path)).toBe(published);
    const { reference, commits } = await getChanged(sandbox.path, '');
    expect(reference).toBe('refs/remotes/origin/main');
    // Only the unpublished commit is new after the remote default; the comparison returns its commit id.
    expect(commits).toStrictEqual([gitOutput(sandbox.path, ['rev-parse', 'HEAD'])]);
};

const trackedBranch = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    const head = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    gitOutput(sandbox.path, ['branch', 'upstream', 'HEAD']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await getPushBase(sandbox.path)).toBe(head);
};

describe('Git change read', () => {
    test('reports an unborn index and its unstaged edits', unbornIndex);

    test('keeps deletion paths in staged and reference comparisons', deletedPaths);

    test('keeps both paths of a rename across directories', renamedPaths);

    test('reports corrupt or absent Git state instead of an empty staged set', corruptState);

    test('rejects invalid reference reads without interpreting options', invalidReference);

    test('push comparison distinguishes an absent upstream from a missing upstream object', absentUpstream);

    test('push comparison reports an unborn or corrupt HEAD instead of inventing a base', unbornHead);

    test('a new branch compares with the remote default without losing unpublished commits', remoteBranch);

    test('a branch with an upstream at HEAD compares with that exact commit', trackedBranch);
});
