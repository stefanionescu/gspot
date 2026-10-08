import { sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { normalizePath } from '#plugin/public.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';

describe('plugin file paths', () => {
    test('a file URL resolves the original file through spaces, percent signs, and Unicode', async () => {
        const content = 'export const count = 1;\n';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source % café.ts': content });
        const path = join(sandbox.path, 'source % café.ts');
        const normalized = normalizePath(pathToFileURL(path).href);
        expect(normalized).toBe(path.split(sep).join('/'));
        expect(await readFile(normalized, 'utf8')).toBe(content);
    });
});

test('Windows paths use forward slashes and the same drive letter case', () => {
    expect(normalizePath(String.raw`C:\repo\src\a.ts`)).toBe('C:/repo/src/a.ts');
    expect(normalizePath(String.raw`c:\repo\src\a.ts`)).toBe('C:/repo/src/a.ts');
});
