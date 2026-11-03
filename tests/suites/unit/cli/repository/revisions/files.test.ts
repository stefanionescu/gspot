import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readHead, readIndexTree } from '#cli/repository/revisions/files.ts';
import { UNREADABLE_HISTORY_MESSAGE } from '#tests/config/repository/files.ts';

test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
    await using sandbox = await createGitSandbox({});
    expect(await readHead(sandbox.path)).toBeUndefined();
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    const historyError = await captureRejection(readHead(sandbox.path));
    expect(historyError.message).toContain(UNREADABLE_HISTORY_MESSAGE);
});

test('the tree of the index is written while the user holds the index lock, and the lock and index stay as they were', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'staged.ts'), 'export const staged = 1;\n');
    runGitStep(sandbox.path, ['add', 'staged.ts']);
    const index = await readFile(join(sandbox.path, '.git', 'index'));
    await writeFile(join(sandbox.path, '.git', 'index.lock'), 'held by git add');
    const tree = await readIndexTree(sandbox.path);
    expect(runGitStep(sandbox.path, ['ls-tree', '--name-only', tree])).toBe('source.ts\nstaged.ts');
    expect(await readFile(join(sandbox.path, '.git', 'index.lock'), 'utf8')).toBe('held by git add');
    expect(await readFile(join(sandbox.path, '.git', 'index'))).toStrictEqual(index);
});
