import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { checkOutRevision } from '#cli/execution/copy/public.ts';
import { NESTED_POLICY_FILES } from '#tests/config/samples/git.ts';
import { getBlobs, getEntries, getHeadEntries } from '#cli/repository/revisions/public.ts';

test('nested policies retain repository context with policy-relative index and committed paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, NESTED_POLICY_FILES);
    const project = join(sandbox.path, 'nested policy');
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    await Bun.write(join(project, 'source.txt'), 'pushed');
    await Bun.write(join(sandbox.path, 'outside.txt'), 'changed context');
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Change']);
    const commitId = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'indexed');
    gitOutput(sandbox.path, ['add', '.']);
    await Bun.write(join(project, 'source.txt'), 'working');
    const headEntries = await getHeadEntries(project);
    expect(headEntries.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    const entries = await getEntries(project, { kind: 'index' });
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', hash: commitId } as const]) {
        await checkOutRevision(project, source, async (copy, tree) => {
            expect(await Bun.file(join(copy, 'source.txt')).text()).toBe(
                source.kind === 'index' ? 'indexed' : 'pushed',
            );
            expect(await Bun.file(join(copy, '..', 'outside.txt')).text()).toBe('changed context');
            expect(gitOutput(copy, ['write-tree'])).toBe(tree);
        });
    }
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('working');
});

// Windows file names cannot hold a newline or a quote.
test.skipIf(!isPosix)('unborn history is empty and committed blobs retain unusual filenames and bytes', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init']);
    expect(await getHeadEntries(sandbox.path)).toStrictEqual([]);
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    const entries = await getHeadEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
    const blobs = await getBlobs(
        sandbox.path,
        entries.map((entry) => entry.hash),
    );
    expect(blobs.get(entries[0]!.hash)?.toString()).toBe('select 1;\n');
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (copy) => {
        expect(await Bun.file(join(copy, path)).text()).toBe('select 1;\n');
    });
    await writeFile(join(sandbox.path, '.git', 'index'), 'broken');
    expect(await rejection(getEntries(sandbox.path, { kind: 'index' }))).toContain('Git ls-files failed');
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    expect(await rejection(getHeadEntries(sandbox.path))).toContain(
        'Cannot read committed Git history. Restore HEAD and check again.',
    );
});
