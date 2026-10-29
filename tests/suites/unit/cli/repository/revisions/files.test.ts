import { join } from 'node:path';
import * as git from '#cli/system/git.ts';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { runGitStep } from '#tests/setup/system/git.ts';
import { LOWERCASE_SELECT_SQL } from '#tests/config/sql.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { UNREADABLE_HISTORY_MESSAGE } from '#tests/config/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readHead, readBlobs, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { SHA1, INDEX_LINE_FAILURE, INVALID_INDEX_LINES } from '#tests/config/parsers/git.ts';

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

test('an unmerged index stage is refused before copying its tree', async () => {
    await using sandbox = await createGitSandbox({});
    using _read = spyOn(git, 'runGitForBytes').mockResolvedValue({
        ...buildProcessResult(),
        stdout: Buffer.from(`100644 ${SHA1} 1\tsource.ts\0`),
    });
    const error = await captureRejection(listRevisionFiles(sandbox.path, { kind: 'index' }));
    expect(error.message).toBe(INDEX_LINE_FAILURE);
});

test.each([...INVALID_INDEX_LINES])('a malformed revision tree is refused: $name', async ({ output }) => {
    await using sandbox = await createGitSandbox({});
    const bytes = Buffer.from(output);
    const tab = bytes.indexOf(9);
    const space = bytes.indexOf(32);
    const tree = Buffer.concat([
        bytes.subarray(0, space + 1),
        Buffer.from('blob '),
        bytes.subarray(space + 1, tab - 2),
        bytes.subarray(tab),
    ]);
    using _read = spyOn(git, 'runGitForBytes').mockResolvedValue({ ...buildProcessResult(), stdout: tree });
    const error = await captureRejection(listRevisionFiles(sandbox.path, { kind: 'commit', hash: SHA1 }));
    expect(error.message).toBe(INDEX_LINE_FAILURE);
});
