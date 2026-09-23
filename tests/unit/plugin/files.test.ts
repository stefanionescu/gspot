import { join, sep } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import { normalizePath, readDirectory } from '#plugin/files.ts';
import { describe, expect, test } from 'bun:test';

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

test('directory inspection propagates a missing path and observes files after correction', async () => {
    await using directory = await testdir();
    const path = join(directory.path, 'source');
    expect(() => readDirectory(path)).toThrow();
    mkdirSync(path);
    expect(readDirectory(path)).toEqual([]);
    writeFileSync(join(path, 'source.ts'), 'export const value = 1;\n');
    mkdirSync(join(path, 'nested'));
    expect(readDirectory(path)).toEqual([
        { name: 'nested', kind: 'dir' },
        { name: 'source.ts', kind: 'file' },
    ]);
});

test('directory inspection refuses a regular file instead of returning no entries', async () => {
    await using directory = await testdir();
    const path = join(directory.path, 'source.ts');
    writeFileSync(path, 'export const value = 1;\n');
    expect(() => readDirectory(path)).toThrow();
    expect(readDirectory(directory.path)).toEqual([{ name: 'source.ts', kind: 'file' }]);
});
