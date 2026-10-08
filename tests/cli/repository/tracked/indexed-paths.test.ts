import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { readIndexEntries } from '#cli/repository/tracked.ts';

test('the index keeps deleted tracked paths, encoded names, and excludes untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });
    expect(await readIndexEntries(sandbox.path)).toStrictEqual([]);
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '--', path]);
    await rm(join(sandbox.path, path));
    const entries = await readIndexEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
});
