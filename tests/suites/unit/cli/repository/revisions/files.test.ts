import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { LOWERCASE_SELECT_SQL } from '#tests/config/sql.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { UNREADABLE_HISTORY_MESSAGE } from '#tests/config/git.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readHead, readBlobs, listRevisionFiles } from '#cli/repository/revisions/files.ts';

test.skipIf(isWindows)('committed blobs keep unusual file names and bytes', async () => {
    await using sandbox = await createGitSandbox({});
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: LOWERCASE_SELECT_SQL });
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-m', 'Sample']);
    const head = await readHead(sandbox.path);
    const files = await listRevisionFiles(sandbox.path, { kind: 'commit', hash: head! });
    expect(files.map((file) => file.path)).toStrictEqual([path]);
    const blobs = await readBlobs(
        sandbox.path,
        files.map((file) => file.hash),
    );
    expect(blobs[0]?.toString()).toBe(LOWERCASE_SELECT_SQL);
});

test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
    await using sandbox = await createGitSandbox({});
    expect(await readHead(sandbox.path)).toBeUndefined();
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    const historyError = await captureRejection(readHead(sandbox.path));
    expect(historyError.message).toContain(UNREADABLE_HISTORY_MESSAGE);
});
