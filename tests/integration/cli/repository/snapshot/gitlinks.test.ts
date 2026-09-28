import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { doctorText, doctorReport } from '#cli/commands/doctor/report.ts';
import { mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { pushedRevisions } from '#cli/repository/revisions/push-selection.ts';
import { gitBlobs, gitEntries, useRevision, committedEntries } from '#cli/repository/revisions/contents.ts';

test.each(['index', 'commit'] as const)(
    'a %s snapshot retains gitlinks without reading submodule contents',
    async (kind) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nkits = []\n[guides]\ninstall = false\n',
            'source.txt': 'selected source',
        });
        await createFileTree(outside.path, { 'package.json': '{', 'source.txt': 'outside source' });
        gitOutput(sandbox.path, ['init']);
        gitOutput(sandbox.path, ['add', '.']);
        gitOutput(sandbox.path, ['commit', '-qm', 'Source']);
        const commitId = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        const path = 'vendor/external project';
        gitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},${path}`]);
        gitOutput(sandbox.path, ['commit', '-qm', 'Gitlink']);
        mkdirSync(join(sandbox.path, 'vendor'));
        symlinkSync(outside.path, join(sandbox.path, path), 'dir');
        expect(submodulePaths(sandbox.path)).toStrictEqual([path]);
        const session = await openSession(sandbox.path);
        expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
        const report = doctorReport(session, undefined);
        expect(report.submodules).toStrictEqual([path]);
        expect(doctorText(report).split(`submodule  ${path} (contents are not read)`)).toHaveLength(2);
        const expected = gitOutput(sandbox.path, ['write-tree']);
        const source = kind === 'index' ? { kind } : { kind, hash: gitOutput(sandbox.path, ['rev-parse', 'HEAD']) };
        await useRevision(sandbox.path, source, async (snapshot, tree) => {
            expect(tree).toBe(expected);
            expect(gitOutput(snapshot, ['write-tree'])).toBe(expected);
            expect(readdirSync(join(snapshot, path))).toStrictEqual([]);
            expect(await Bun.file(join(snapshot, 'source.txt')).text()).toBe('selected source');
            expect(submodulePaths(snapshot)).toStrictEqual([path]);
        });
        expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{');
        expect(await Bun.file(join(outside.path, 'source.txt')).text()).toBe('outside source');
    },
);

test('nested policies retain repository context with policy-relative index and committed paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'outside.txt': 'repository context',
        'nested policy/source.txt': 'committed',
    });
    const project = join(sandbox.path, 'nested policy');
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    const base = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'pushed');
    await Bun.write(join(sandbox.path, 'outside.txt'), 'changed context');
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Change']);
    const commitId = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'indexed');
    gitOutput(sandbox.path, ['add', '.']);
    await Bun.write(join(project, 'source.txt'), 'working');
    const afterWrite = await committedEntries(project);
    expect(afterWrite.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    const entries = await gitEntries(project, { kind: 'index' });
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', hash: commitId } as const]) {
        await useRevision(project, source, async (snapshot, tree) => {
            expect(await Bun.file(join(snapshot, 'source.txt')).text()).toBe(
                source.kind === 'index' ? 'indexed' : 'pushed',
            );
            expect(await Bun.file(join(snapshot, '..', 'outside.txt')).text()).toBe('changed context');
            expect(gitOutput(snapshot, ['write-tree'])).toBe(tree);
        });
    }
    const protocol = `refs/heads/main ${commitId} refs/heads/main ${base}\n`;
    const updated = await pushedRevisions(project, protocol);
    expect(updated.revisions[0]?.paths).toStrictEqual(['source.txt']);
    gitOutput(sandbox.path, ['config', 'remote.example.fetch', '+refs/heads/*:refs/remotes/example/*']);
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/example/main', base]);
    const createdRef = `refs/heads/new ${commitId} refs/heads/new ${'0'.repeat(commitId.length)}\n`;
    const created = await pushedRevisions(project, createdRef, 'example');
    expect(created.revisions[0]?.paths).toStrictEqual(['source.txt']);
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('working');
});

// Windows file names cannot hold a newline or a quote.
if (process.platform !== 'win32')
    test('unborn history is empty and committed blobs retain unusual filenames and bytes', async () => {
        await using sandbox = await testdir();
        gitOutput(sandbox.path, ['init']);
        expect(await committedEntries(sandbox.path)).toStrictEqual([]);
        const path = 'a\n"é.sql';
        await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
        gitOutput(sandbox.path, ['add', '.']);
        gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
        const entries = await committedEntries(sandbox.path);
        expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
        const blobs = await gitBlobs(
            sandbox.path,
            entries.map((entry) => entry.hash),
        );
        expect(blobs.get(entries[0]!.hash)?.toString()).toBe('select 1;\n');
        await useRevision(sandbox.path, { kind: 'index' }, async (snapshot) => {
            expect(await Bun.file(join(snapshot, path)).text()).toBe('select 1;\n');
        });
        writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
        await rejects(gitEntries(sandbox.path, { kind: 'index' }), { message: /Cannot read the Git index/u });
        writeFileSync(join(sandbox.path, '.git', 'HEAD'), 'broken');
        await rejects(committedEntries(sandbox.path));
    });
