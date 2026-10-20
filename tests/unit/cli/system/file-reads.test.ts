import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { rm, link, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { readText, readBytes, readCachedText, readCachedBytes, readCachedPrefix } from '#cli/system/files/reads.ts';

test('reads tell a missing optional file, required bytes, and invalid UTF-8 apart', async () => {
    await using folder = await testdir();
    expect(readText(folder.path, 'source.txt')).toBeUndefined();
    expect(() => readBytes(folder.path, 'source.txt')).toThrow('ENOENT');
    const target = join(folder.path, 'source.txt');
    const invalid = Buffer.from([0xc3, 0x28]);
    await writeFile(target, invalid);
    expect(readBytes(folder.path, 'source.txt')).toStrictEqual(invalid);
    const failure = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: 'source.txt is not UTF-8 text. Save it as UTF-8, then run the command again.',
    });
    expect(() => readText(folder.path, 'source.txt')).toThrow(failure);
    expect(() => readCachedText(createReadCache(folder.path), 'source.txt')).toThrow(failure);
    expect(await readFile(target)).toStrictEqual(invalid);
    await writeFile(target, 'valid café\n');
    expect(readText(folder.path, 'source.txt')).toBe('valid café\n');
    expect(readCachedPrefix(createReadCache(folder.path), 'source.txt', 5)).toStrictEqual(Buffer.from('valid'));
    await rm(target);
    await mkdir(target);
    expect(() => readText(folder.path, 'source.txt')).toThrow('EISDIR');
});

test('text reads follow file and folder links inside the folder and read hard links', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, { 'settings/source.txt': 'authored café\n' });
    await symlink('settings/source.txt', join(folder.path, 'linked.txt'));
    await symlink('settings', join(folder.path, 'linked-folder'), 'dir');
    await link(join(folder.path, 'settings/source.txt'), join(folder.path, 'hardlinked.txt'));
    expect(readText(folder.path, 'linked.txt')).toBe('authored café\n');
    expect(readText(folder.path, 'linked-folder/source.txt')).toBe('authored café\n');
    expect(readText(folder.path, 'hardlinked.txt')).toBe('authored café\n');
    expect(await readFile(join(folder.path, 'settings/source.txt'), 'utf8')).toBe('authored café\n');
});

test('reads refuse a link chain that leaves the folder and work after the link is fixed', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'project/inside.txt': 'inside',
        'outside/source.txt': 'outside',
    });
    const root = join(folder.path, 'project');
    await symlink('../outside/source.txt', join(root, 'linked.txt'));
    expect(() => readText(root, 'linked.txt')).toThrow('Source link leaves the repository: linked.txt');
    expect(() => readCachedPrefix(createReadCache(root), 'linked.txt', 4)).toThrow(
        'Source link leaves the repository: linked.txt',
    );
    expect(await readFile(join(folder.path, 'outside/source.txt'), 'utf8')).toBe('outside');
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
    expect(readCachedText(reads, 'source.txt')).toBe('first');
    await writeFile(join(first.path, 'source.txt'), 'edited');
    expect(readCachedText(reads, 'source.txt')).toBe('first');
    expect(readText(reads.root, 'source.txt')).toBe('edited');
    expect(readText(second.path, 'source.txt')).toBe('second');
});

test('the read cache never serves another folder or a failed read', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    await createFileTree(scratch.path, { 'source.txt': 'before generation' });
    const reads = createReadCache(sandbox.path);
    expect(readCachedBytes(reads, 'source.txt').toString()).toBe('original');
    expect(readBytes(scratch.path, 'source.txt').toString()).toBe('before generation');
    await Bun.write(join(scratch.path, 'source.txt'), 'after generation');
    expect(readBytes(scratch.path, 'source.txt').toString()).toBe('after generation');
    expect(() => readCachedBytes(reads, 'missing.txt')).toThrow('missing.txt');
    await Bun.write(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readCachedBytes(reads, 'missing.txt').toString()).toBe('recovered');
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('original');
});
