import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
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
    git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'Fixture');
}

describe('Git change observation', () => {
    test('reports an unborn index and its unstaged edits', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        git(fixture.path, 'init');
        git(fixture.path, 'add', 'source.ts');
        expect(stagedFiles(fixture.path)).toEqual({ staged: ['source.ts'], unstaged: 0 });
        writeFileSync(join(fixture.path, 'source.ts'), 'export const answer = 42;\n');
        expect(stagedFiles(fixture.path)).toEqual({ staged: ['source.ts'], unstaged: 1 });
    });

    test('keeps deletion paths in staged and reference comparisons', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        commit(fixture.path);
        git(fixture.path, 'rm', 'source.ts');
        expect(stagedFiles(fixture.path).staged).toEqual(['source.ts']);
        expect(changedSince(fixture.path, 'HEAD')).toEqual(['source.ts']);
    });

    test('keeps both paths of a rename across directories', async () => {
        await using fixture = await createFixture({ 'api/source.ts': 'export {};\n', 'web/kept.ts': 'export {};\n' });
        commit(fixture.path);
        git(fixture.path, 'mv', 'api/source.ts', 'web/source.ts');
        expect(stagedFiles(fixture.path).staged).toEqual(['api/source.ts', 'web/source.ts']);
        expect(changedSince(fixture.path, 'HEAD')).toEqual(['api/source.ts', 'web/source.ts']);
    });

    test('reports corrupt or absent Git state instead of an empty staged set', async () => {
        await using fixture = await createFixture({});
        expect(() => stagedFiles(fixture.path)).toThrow('Git diff failed');
        git(fixture.path, 'init');
        writeFileSync(join(fixture.path, '.git/index'), 'corrupt index');
        expect(() => stagedFiles(fixture.path)).toThrow('Git diff failed');
    });

    test('rejects invalid reference observations without interpreting options', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        commit(fixture.path);
        expect(changedSince(fixture.path, 'HEAD')).toEqual([]);
        expect(() => changedSince(fixture.path, 'missing-reference')).toThrow('Git merge-base failed');
        expect(() => changedSince(fixture.path, '--output=outside.txt')).toThrow('Git merge-base failed');
        expect(existsSync(join(fixture.path, 'outside.txt'))).toBe(false);
    });
    test('push comparison distinguishes an absent upstream from a missing upstream object', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        commit(fixture.path);
        const first = pushBase(fixture.path);
        git(fixture.path, 'branch', 'upstream');
        git(fixture.path, 'branch', '--set-upstream-to=upstream');
        await Bun.write(join(fixture.path, 'source.ts'), 'export const changed = true;\n');
        git(fixture.path, 'add', '.');
        git(fixture.path, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'Second');
        expect(pushBase(fixture.path)).toBe(first);
        git(fixture.path, 'update-ref', '-d', 'refs/heads/upstream');
        expect(() => pushBase(fixture.path)).toThrow('Git merge-base failed');
    });

    test('push comparison reports an unborn or corrupt HEAD instead of inventing a base', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        git(fixture.path, 'init');
        expect(() => pushBase(fixture.path)).toThrow('Git rev-parse failed');
        commit(fixture.path);
        writeFileSync(join(fixture.path, '.git/HEAD'), 'broken head');
        expect(() => pushBase(fixture.path)).toThrow('Git rev-parse failed');
    });
});
