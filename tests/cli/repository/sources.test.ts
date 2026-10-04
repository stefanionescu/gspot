import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { readText, readPrefix, readSource } from '#cli/platform/source.ts';
import { rmSync, linkSync, mkdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('source reads distinguish missing optional text, required bytes, and invalid UTF-8', async () => {
    await using directory = await testdir();
    expect(readText(directory.path, 'source.txt')).toBeUndefined();
    expect(() => readSource(directory.path, 'source.txt')).toThrow('ENOENT');
    const target = join(directory.path, 'source.txt');
    const invalid = Buffer.from([0xc3, 0x28]);
    writeFileSync(target, invalid);
    expect(readSource(directory.path, 'source.txt')).toStrictEqual(invalid);
    expect(() => readText(directory.path, 'source.txt')).toThrow('source.txt is not UTF-8 text.');
    expect(readFileSync(target)).toStrictEqual(invalid);
    writeFileSync(target, 'valid café\n');
    expect(readText(directory.path, 'source.txt')).toBe('valid café\n');
    expect(readPrefix(directory.path, 'source.txt', 5)).toStrictEqual(Buffer.from('valid'));
    rmSync(target);
    mkdirSync(target);
    expect(() => readText(directory.path, 'source.txt')).toThrow('EISDIR');
});

test('authored text follows file and directory links inside its root and reads hard-linked content', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'settings/source.txt': 'authored café\n' });
    symlinkSync('settings/source.txt', join(directory.path, 'linked.txt'));
    symlinkSync('settings', join(directory.path, 'linked-folder'), 'dir');
    linkSync(join(directory.path, 'settings/source.txt'), join(directory.path, 'hardlinked.txt'));
    expect(readText(directory.path, 'linked.txt')).toBe('authored café\n');
    expect(readText(directory.path, 'linked-folder/source.txt')).toBe('authored café\n');
    expect(readText(directory.path, 'hardlinked.txt')).toBe('authored café\n');
    expect(readFileSync(join(directory.path, 'settings/source.txt'), 'utf8')).toBe('authored café\n');
});

test('source reads refuse a link chain outside its root and succeed after the link is corrected', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/inside.txt': 'inside',
        'outside/source.txt': 'outside',
    });
    const root = join(directory.path, 'project');
    symlinkSync('../outside/source.txt', join(root, 'linked.txt'));
    expect(() => readText(root, 'linked.txt')).toThrow('Source link leaves the repository: linked.txt');
    expect(() => readPrefix(root, 'linked.txt', 4)).toThrow('Source link leaves the repository: linked.txt');
    expect(readFileSync(join(directory.path, 'outside/source.txt'), 'utf8')).toBe('outside');
    rmSync(join(root, 'linked.txt'));
    symlinkSync('inside.txt', join(root, 'linked.txt'));
    expect(readText(root, 'linked.txt')).toBe('inside');
});

test('run-owned reads hold one repository snapshot and uncached reads observe later edits', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await createFileTree(first.path, { 'source.txt': 'first' });
    await createFileTree(second.path, { 'source.txt': 'second' });
    const reads: ReadCache = { root: first.path, sources: new Map(), memo: new Map() };
    expect(readText(first.path, 'source.txt', reads)).toBe('first');
    writeFileSync(join(first.path, 'source.txt'), 'edited');
    expect(readText(first.path, 'source.txt', reads)).toBe('first');
    expect(readText(first.path, 'source.txt')).toBe('edited');
    expect(readText(second.path, 'source.txt', reads)).toBe('second');
    expect(reads.sources.get('source.txt')).toStrictEqual(Buffer.from('first'));
});
