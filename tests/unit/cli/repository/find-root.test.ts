import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { findRoot, isGitRepository } from '#cli/repository/find-root.ts';

test('finds the nearest gspot.toml in a folder with no Git', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = []\n',
        'nested/source.ts': 'export {});\n',
    });
    expect(findRoot(join(sandbox.path, 'nested'))).toBe(sandbox.path);
});

test('keeps the requested folder when no Git root or gspot.toml exists', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {});\n' });
    expect(findRoot(sandbox.path)).toBe(sandbox.path);
    expect(isGitRepository(sandbox.path)).toBe(false);
});
