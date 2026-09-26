import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, writeFileSync } from 'node:fs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { changedFiles, pushBase, stagedFiles } from '#cli/repository/revisions/selection.ts';

function git(root: string, ...argv: string[]): void {
    const result = runBlocking(['git', ...argv], { cwd: root });
    expect(result.code, result.stderr).toBe(0);
}

function commit(root: string): void {
    git(root, 'init');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Sandbox');
}

describe('Git change observation', () => {
    test('reports an unborn index and its unstaged edits', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        git(sandbox.path, 'init');
        git(sandbox.path, 'add', 'source.ts');
        expect(await stagedFiles(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 0 });
        writeFileSync(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
        expect(await stagedFiles(sandbox.path)).toStrictEqual({ staged: ['source.ts'], unstaged: 1 });
    });

    test('keeps deletion paths in staged and reference comparisons', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        commit(sandbox.path);
        git(sandbox.path, 'rm', 'source.ts');
        expect((await stagedFiles(sandbox.path)).staged).toStrictEqual(['source.ts']);
        expect((await changedFiles(sandbox.path, 'HEAD')).paths).toStrictEqual(['source.ts']);
    });

    test('keeps both paths of a rename across directories', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
        commit(sandbox.path);
        git(sandbox.path, 'mv', 'api/source.ts', 'web/source.ts');
        expect((await stagedFiles(sandbox.path)).staged).toStrictEqual(['api/source.ts', 'web/source.ts']);
        expect((await changedFiles(sandbox.path, 'HEAD')).paths).toStrictEqual(['api/source.ts', 'web/source.ts']);
    });

    test('reports corrupt or absent Git state instead of an empty staged set', async () => {
        await using sandbox = await testdir();
        await expect(stagedFiles(sandbox.path)).rejects.toThrow('Git diff failed');
        git(sandbox.path, 'init');
        writeFileSync(join(sandbox.path, '.git/index'), 'corrupt index');
        await expect(stagedFiles(sandbox.path)).rejects.toThrow('Git diff failed');
    });

    test('rejects invalid reference observations without interpreting options', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        commit(sandbox.path);
        expect((await changedFiles(sandbox.path, 'HEAD')).paths).toStrictEqual([]);
        await expect(changedFiles(sandbox.path, 'missing-reference')).rejects.toThrow('Git merge-base failed');
        await expect(changedFiles(sandbox.path, '--output=outside.txt')).rejects.toThrow('Git merge-base failed');
        expect(existsSync(join(sandbox.path, 'outside.txt'))).toBe(false);
    });
    test('push comparison distinguishes an absent upstream from a missing upstream object', async () => {
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
        await expect(pushBase(sandbox.path)).rejects.toThrow('Git merge-base failed');
    });

    test('push comparison reports an unborn or corrupt HEAD instead of inventing a base', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        git(sandbox.path, 'init');
        await expect(pushBase(sandbox.path)).rejects.toThrow('Git rev-parse failed');
        commit(sandbox.path);
        writeFileSync(join(sandbox.path, '.git/HEAD'), 'broken head');
        await expect(pushBase(sandbox.path)).rejects.toThrow('Git rev-parse failed');
    });
});
