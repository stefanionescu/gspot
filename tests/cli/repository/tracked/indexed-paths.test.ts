import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { indexedPaths } from '#cli/repository/tracked.ts';

test('the index keeps deleted tracked paths, encoded names, and excludes untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });
    expect(indexedPaths(sandbox.path)).toStrictEqual([]);
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '--', path]);
    rmSync(join(sandbox.path, path));
    expect(indexedPaths(sandbox.path)).toStrictEqual([path]);
});
