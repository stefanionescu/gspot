import { sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { normalizePath, readDirectory } from '#plugin/files.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

describe('plugin file paths', () => {
    test('a file URL resolves the original file through spaces, percent signs, and Unicode', async () => {
        const content = 'export const count = 1;\n';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source % café.ts': content });
        const path = join(sandbox.path, 'source % café.ts');
        const normalized = normalizePath(pathToFileURL(path).href);
        expect(normalized).toBe(path.split(sep).join('/'));
        expect(readFileSync(normalized, 'utf8')).toBe(content);
    });
});

test('directory inspection lists files and folders by name with their kind', async () => {
    await using directory = await testdir();
    writeFileSync(join(directory.path, 'source.ts'), 'export const value = 1;\n');
    mkdirSync(join(directory.path, 'nested'));
    expect(readDirectory(directory.path)).toStrictEqual([
        { name: 'nested', kind: 'dir' },
        { name: 'source.ts', kind: 'file' },
    ]);
});
