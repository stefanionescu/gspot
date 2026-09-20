import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { changedSince, stagedFiles, pushBase } from '#cli/repository/staged.ts';

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
        await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
        git(sandbox.path, 'init');
        git(sandbox.path, 'add', 'source.ts');
        expect(stagedFiles(sandbox.path)).toEqual({ staged: ['source.ts'], unstaged: 0 });
        writeFileSync(join(sandbox.path, 'source.ts'), 'export const answer = 42;\n');
        expect(stagedFiles(sandbox.path)).toEqual({ staged: ['source.ts'], unstaged: 1 });
    });

    test('keeps deletion paths in staged and reference comparisons', async () => {
        await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
        commit(sandbox.path);
        git(sandbox.path, 'rm', 'source.ts');
        expect(stagedFiles(sandbox.path).staged).toEqual(['source.ts']);
        expect(changedSince(sandbox.path, 'HEAD')).toEqual(['source.ts']);
    });

    test('keeps both paths of a rename across directories', async () => {
        await using sandbox = await createSandbox({ 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
        commit(sandbox.path);
        git(sandbox.path, 'mv', 'api/source.ts', 'web/source.ts');
        expect(stagedFiles(sandbox.path).staged).toEqual(['api/source.ts', 'web/source.ts']);
        expect(changedSince(sandbox.path, 'HEAD')).toEqual(['api/source.ts', 'web/source.ts']);
    });

    test('reports corrupt or absent Git state instead of an empty staged set', async () => {
        await using sandbox = await createSandbox({});
        expect(() => stagedFiles(sandbox.path)).toThrow('Git diff failed');
        git(sandbox.path, 'init');
        writeFileSync(join(sandbox.path, '.git/index'), 'corrupt index');
        expect(() => stagedFiles(sandbox.path)).toThrow('Git diff failed');
    });

    test('rejects invalid reference observations without interpreting options', async () => {
        await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
        commit(sandbox.path);
        expect(changedSince(sandbox.path, 'HEAD')).toEqual([]);
        expect(() => changedSince(sandbox.path, 'missing-reference')).toThrow('Git merge-base failed');
        expect(() => changedSince(sandbox.path, '--output=outside.txt')).toThrow('Git merge-base failed');
        expect(existsSync(join(sandbox.path, 'outside.txt'))).toBe(false);
    });
    test('push comparison distinguishes an absent upstream from a missing upstream object', async () => {
        await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
        commit(sandbox.path);
        const first = pushBase(sandbox.path);
        git(sandbox.path, 'branch', 'upstream');
        git(sandbox.path, 'branch', '--set-upstream-to=upstream');
        await Bun.write(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
        git(sandbox.path, 'add', '.');
        git(sandbox.path, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Second');
        expect(pushBase(sandbox.path)).toBe(first);
        git(sandbox.path, 'update-ref', '-d', 'refs/heads/upstream');
        expect(() => pushBase(sandbox.path)).toThrow('Git merge-base failed');
    });

    test('push comparison reports an unborn or corrupt HEAD instead of inventing a base', async () => {
        await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
        git(sandbox.path, 'init');
        expect(() => pushBase(sandbox.path)).toThrow('Git rev-parse failed');
        commit(sandbox.path);
        writeFileSync(join(sandbox.path, '.git/HEAD'), 'broken head');
        expect(() => pushBase(sandbox.path)).toThrow('Git rev-parse failed');
    });
});
