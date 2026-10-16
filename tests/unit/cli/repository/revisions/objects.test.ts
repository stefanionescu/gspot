import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { readBlobs, listHeadEntries } from '#cli/repository/revisions/tree-entries.ts';

// Windows file names cannot hold a newline or a quote.
test.skipIf(isWindows)('committed blobs keep unusual file names and bytes', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init']);
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    const entries = await listHeadEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
    const blobs = await readBlobs(
        sandbox.path,
        entries.map((entry) => entry.hash),
    );
    expect(blobs[0]?.toString()).toBe('select 1;\n');
});

test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init']);
    expect(await listHeadEntries(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    expect(await rejection(listHeadEntries(sandbox.path))).toContain(
        'Cannot read committed Git history. Restore HEAD and check again.',
    );
});
