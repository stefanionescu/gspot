import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rm, link, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { readText, readPrefix, readSource, createReadCache } from '#cli/system/file-reads.ts';

test('reads tell a missing optional file, required bytes, and invalid UTF-8 apart', async () => {
    await using directory = await testdir();
    expect(readText(directory.path, 'source.txt')).toBeUndefined();
    expect(() => readSource(directory.path, 'source.txt')).toThrow('ENOENT');
    const target = join(directory.path, 'source.txt');
    const invalid = Buffer.from([0xc3, 0x28]);
    await writeFile(target, invalid);
    expect(readSource(directory.path, 'source.txt')).toStrictEqual(invalid);
    expect(() => readText(directory.path, 'source.txt')).toThrow('source.txt is not UTF-8 text.');
    expect(await readFile(target)).toStrictEqual(invalid);
    await writeFile(target, 'valid café\n');
    expect(readText(directory.path, 'source.txt')).toBe('valid café\n');
    expect(readPrefix(directory.path, 'source.txt', 5)).toStrictEqual(Buffer.from('valid'));
    await rm(target);
    await mkdir(target);
    expect(() => readText(directory.path, 'source.txt')).toThrow('EISDIR');
});

test('text reads follow file and folder links inside the folder and read hard links', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'settings/source.txt': 'authored café\n' });
    await symlink('settings/source.txt', join(directory.path, 'linked.txt'));
    await symlink('settings', join(directory.path, 'linked-folder'), 'dir');
    await link(join(directory.path, 'settings/source.txt'), join(directory.path, 'hardlinked.txt'));
    expect(readText(directory.path, 'linked.txt')).toBe('authored café\n');
    expect(readText(directory.path, 'linked-folder/source.txt')).toBe('authored café\n');
    expect(readText(directory.path, 'hardlinked.txt')).toBe('authored café\n');
    expect(await readFile(join(directory.path, 'settings/source.txt'), 'utf8')).toBe('authored café\n');
});

test('reads refuse a link chain that leaves the folder and work after the link is fixed', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/inside.txt': 'inside',
        'outside/source.txt': 'outside',
    });
    const root = join(directory.path, 'project');
    await symlink('../outside/source.txt', join(root, 'linked.txt'));
    expect(() => readText(root, 'linked.txt')).toThrow('Source link leaves the repository: linked.txt');
    expect(() => readPrefix(root, 'linked.txt', 4)).toThrow('Source link leaves the repository: linked.txt');
    expect(await readFile(join(directory.path, 'outside/source.txt'), 'utf8')).toBe('outside');
    await rm(join(root, 'linked.txt'));
    await symlink('inside.txt', join(root, 'linked.txt'));
    expect(readText(root, 'linked.txt')).toBe('inside');
});

test('the read cache keeps one copy per run and uncached reads see later edits', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await createFileTree(first.path, { 'source.txt': 'first' });
    await createFileTree(second.path, { 'source.txt': 'second' });
    const reads = createReadCache(first.path);
    expect(readText(reads.root, 'source.txt', reads)).toBe('first');
    await writeFile(join(first.path, 'source.txt'), 'edited');
    expect(readText(reads.root, 'source.txt', reads)).toBe('first');
    expect(readText(reads.root, 'source.txt')).toBe('edited');
    expect(readText(second.path, 'source.txt', reads)).toBe('second');
    expect(reads.sources.get('source.txt')).toStrictEqual(Buffer.from('first'));
});

test('the read cache never serves another folder or a failed read', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    await createFileTree(scratch.path, { 'source.txt': 'before generation' });
    const reads = createReadCache(sandbox.path);
    expect(readSource(reads.root, 'source.txt', reads).toString()).toBe('original');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('before generation');
    await Bun.write(join(scratch.path, 'source.txt'), 'after generation');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('after generation');
    expect(() => readSource(reads.root, 'missing.txt', reads)).toThrow('missing.txt');
    await Bun.write(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readSource(reads.root, 'missing.txt', reads).toString()).toBe('recovered');
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('original');
});
