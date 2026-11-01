import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readHead } from '#cli/repository/revisions/files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { UNREADABLE_HISTORY_MESSAGE } from '#tests/config/repository/files.ts';

test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
    await using sandbox = await createGitSandbox({});
    expect(await readHead(sandbox.path)).toBeUndefined();
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    const historyError = await captureRejection(readHead(sandbox.path));
    expect(historyError.message).toContain(UNREADABLE_HISTORY_MESSAGE);
});
