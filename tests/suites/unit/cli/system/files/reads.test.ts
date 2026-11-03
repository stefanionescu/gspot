import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createRunCache } from '#cli/system/cache.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { rm, link, mkdir, symlink, writeFile } from 'node:fs/promises';
import { findText, readText, readBytes } from '#cli/system/files/reads.ts';

test('a tracked link whose target is missing reads as empty text, not as a missing file', async () => {
    await using sandbox = await testdir();
    await symlink('absent.md', join(sandbox.path, 'dangling.md'));
    expect(readText(sandbox.path, 'dangling.md')).toBe('');
    expect(readText(createRunCache(sandbox.path), 'dangling.md')).toBe('');
});

test('reads tell a missing optional file, required bytes, and invalid UTF-8 apart', async () => {
    await using sandbox = await testdir();
    expect(findText(sandbox.path, 'source.txt')).toBeUndefined();
    expect(findText(createRunCache(sandbox.path), 'source.txt')).toBeUndefined();
    const missing = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: 'source.txt is tracked but missing. Restore it or commit its deletion.',
    });
    expect(() => readText(sandbox.path, 'source.txt')).toThrow(missing);
    expect(() => readText(createRunCache(sandbox.path), 'source.txt')).toThrow(missing);
    expect(() => readBytes(sandbox.path, 'source.txt')).toThrow('ENOENT');
    const target = join(sandbox.path, 'source.txt');
    const invalid = Buffer.from([0xc3, 0x28]);
    await writeFile(target, invalid);
    expect(readBytes(sandbox.path, 'source.txt')).toStrictEqual(invalid);
    const failure = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: 'source.txt is not UTF-8 text. Save it as UTF-8, then run the command again.',
    });
    expect(() => readText(sandbox.path, 'source.txt')).toThrow(failure);
    expect(() => readText(createRunCache(sandbox.path), 'source.txt')).toThrow(failure);
    await writeFile(target, 'valid café\n');
    expect(readText(sandbox.path, 'source.txt')).toBe('valid café\n');
    expect(readBytes(createRunCache(sandbox.path), 'source.txt', { limit: 5 })).toStrictEqual(Buffer.from('valid'));
    await rm(target);
    await mkdir(target);
    const unreadable = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: 'source.txt could not be read. Check the file and its permissions.',
    });
    expect(() => findText(sandbox.path, 'source.txt')).toThrow(unreadable);
    expect(() => findText(createRunCache(sandbox.path), 'source.txt')).toThrow(unreadable);
    expect(() => readText(sandbox.path, 'source.txt')).toThrow(unreadable);
    expect(() => readText(createRunCache(sandbox.path), 'source.txt')).toThrow(unreadable);
    expect(() => readBytes(sandbox.path, 'source.txt')).toThrow('EISDIR');
});

test('text reads follow file and folder links inside the folder and read hard links', async () => {
    await using sandbox = await testdir({ 'settings/source.txt': 'authored café\n' });

    await symlink('settings/source.txt', join(sandbox.path, 'linked.txt'));
    await symlink('settings', join(sandbox.path, 'linked-folder'), 'dir');
    await link(join(sandbox.path, 'settings/source.txt'), join(sandbox.path, 'hardlinked.txt'));
    expect(readText(sandbox.path, 'linked.txt')).toBe('authored café\n');
    expect(readText(sandbox.path, 'linked-folder/source.txt')).toBe('authored café\n');
    expect(readText(sandbox.path, 'hardlinked.txt')).toBe('authored café\n');
});

test('reads refuse a link chain that leaves the folder and work after the link is fixed', async () => {
    await using sandbox = await testdir({
        'project/inside.txt': 'inside',
        'outside/source.txt': 'outside',
    });

    const root = join(sandbox.path, 'project');
    await symlink('../outside/source.txt', join(root, 'linked.txt'));
    expect(() => readText(root, 'linked.txt')).toThrow(
        matchFields({ message: 'linked.txt links to a file outside the repository. Replace the link with the file.' }),
    );
    expect(() => readBytes(createRunCache(root), 'linked.txt', { limit: 4 })).toThrow(
        'linked.txt links to a file outside the repository. Replace the link with the file.',
    );
    await rm(join(root, 'linked.txt'));
    await symlink('inside.txt', join(root, 'linked.txt'));
    expect(readText(root, 'linked.txt')).toBe('inside');
});

test('the run cache keeps one copy per run and uncached reads see later edits', async () => {
    await using first = await testdir();
    await createFileTree(first.path, { 'source.txt': 'first' });
    const cache = createRunCache(first.path);
    expect(readText(cache, 'source.txt')).toBe('first');
    await writeFile(join(first.path, 'source.txt'), 'edited');
    expect(readText(cache, 'source.txt')).toBe('first');
    expect(readText(cache.root, 'source.txt')).toBe('edited');
});

test('the run cache does not keep a failed read', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    const cache = createRunCache(sandbox.path);
    expect(readBytes(cache, 'source.txt').toString()).toBe('original');
    expect(() => readBytes(cache, 'missing.txt')).toThrow('missing.txt');
    await writeFile(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readBytes(cache, 'missing.txt').toString()).toBe('recovered');
});
