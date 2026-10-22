import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGitStep } from '#tests/setup/system/git.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { readBlobs, listHeadEntries } from '#cli/repository/revisions/files.ts';

// Windows file names cannot hold a newline or a quote.
test.skipIf(isWindows)('committed blobs keep unusual file names and bytes', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init']);
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-m', 'Fixture']);
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
    runGitStep(sandbox.path, ['init']);
    expect(await listHeadEntries(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    expect(await captureRejection(listHeadEntries(sandbox.path))).toContain(
        'Cannot read committed Git history. Restore HEAD and check again.',
    );
});
