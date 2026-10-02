import { sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizePath, readDirectory, relativeToRoot } from '#plugin/files.ts';

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

test('a Windows path, with its drive letter in either case, resolves against the root as a POSIX path does', () => {
    expect(normalizePath(String.raw`C:\repo\src\a.ts`)).toBe('C:/repo/src/a.ts');
    expect(relativeToRoot(normalizePath(String.raw`c:\repo`), normalizePath(String.raw`C:\repo\src\a.ts`))).toBe(
        'src/a.ts',
    );
    expect(relativeToRoot(normalizePath('C:/repo'), normalizePath('c:/repo/src/a.ts'))).toBe('src/a.ts');
    expect(relativeToRoot('/repo', '/repo/src/a.ts')).toBe('src/a.ts');
});
