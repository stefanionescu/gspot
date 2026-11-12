import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listCommittedPaths, listRevisionFiles, readHead, writeIndexTree } from '#cli/repository/revisions/files.ts';
import type { GitFile } from '#cli/types/repository.ts';
import { HASH_FORMATS, INDEX_PATH } from '#tests/config/repository/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
    await using sandbox = await createGitSandbox({});
    expect(await readHead(sandbox.path)).toBeUndefined();
    await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
    const historyError = await captureRejection(readHead(sandbox.path));
    expect(historyError).toMatchObject({ name: 'GspotError', code: 'git' });
});

test('the tree of the index is written while the user holds the index lock, and the lock and index stay as they were', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'staged.ts'), 'export const staged = 1;\n');
    runGitStep(sandbox.path, ['add', 'staged.ts']);
    const index = await readFile(join(sandbox.path, '.git', 'index'));
    await writeFile(join(sandbox.path, '.git', 'index.lock'), 'held by git add');
    const tree = await writeIndexTree(sandbox.path);
    expect(runGitStep(sandbox.path, ['ls-tree', '--name-only', tree])).toBe('source.ts\nstaged.ts');
    expect(await readFile(join(sandbox.path, '.git', 'index.lock'), 'utf8')).toBe('held by git add');
    expect(await readFile(join(sandbox.path, '.git', 'index'))).toStrictEqual(index);
});

test('a revision lists the entries of its tree, with SHA-1 and SHA-256 hashes', async () => {
    for (const { format, hashLength } of HASH_FORMATS) {
        await using sandbox = await testdir({ blob: 'contents\n' });
        runGitStep(sandbox.path, ['init', '--quiet', `--object-format=${format}`]);
        const hash = runGitStep(sandbox.path, ['hash-object', '-w', 'blob']);
        const entries: GitFile[] = [
            { mode: '100755', hash, path: 'executable' },
            { mode: '100644', hash, path: INDEX_PATH },
            { mode: '120000', hash, path: 'link' },
            { mode: '160000', hash, path: 'submodule' },
        ];
        for (const entry of entries)
            runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', entry.mode, entry.hash, entry.path]);
        runGitStep(sandbox.path, ['commit', '--quiet', '--message', 'init']);
        const head = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
        expect(hash).toHaveLength(hashLength);
        expect(await listRevisionFiles(sandbox.path, { kind: 'commit', hash: head })).toStrictEqual(entries);
    }
});

test('committed paths leave out files that changed since HEAD, and an unborn history has none', async () => {
    await using sandbox = await createGitSandbox({ a: 'kept\n', b: 'kept\n' });
    expect(await listCommittedPaths(sandbox.path, ['a', 'b'])).toStrictEqual(new Set());
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'b'), 'changed\n');
    expect(await listCommittedPaths(sandbox.path, ['a', 'b'])).toStrictEqual(new Set(['a']));
});
