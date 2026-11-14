import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createRunCache } from '#cli/system/cache.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { rm, mkdir, symlink, writeFile } from 'node:fs/promises';
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
    const missing = matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' });
    expect(() => readText(sandbox.path, 'source.txt')).toThrow(missing);
    expect(() => readText(createRunCache(sandbox.path), 'source.txt')).toThrow(missing);
    expect(() => readBytes(sandbox.path, 'source.txt')).toThrow(matchFields<NodeJS.ErrnoException>({ code: 'ENOENT' }));
    const target = join(sandbox.path, 'source.txt');
    const invalid = Buffer.from([0xc3, 0x28]);
    await writeFile(target, invalid);
    expect(readBytes(sandbox.path, 'source.txt')).toStrictEqual(invalid);
    const failure = matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' });
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
        cause: matchFields<NodeJS.ErrnoException>({ code: 'EISDIR' }),
    });
    expect(() => findText(sandbox.path, 'source.txt')).toThrow(unreadable);
    expect(() => findText(createRunCache(sandbox.path), 'source.txt')).toThrow(unreadable);
    expect(() => readText(sandbox.path, 'source.txt')).toThrow(unreadable);
    expect(() => readText(createRunCache(sandbox.path), 'source.txt')).toThrow(unreadable);
    expect(() => readBytes(sandbox.path, 'source.txt')).toThrow(matchFields<NodeJS.ErrnoException>({ code: 'EISDIR' }));
});

test('reads refuse a link chain that leaves the folder and work after the link is fixed', async () => {
    await using sandbox = await testdir({
        'project/inside.txt': 'inside',
        'outside/source.txt': 'outside',
    });

    const root = join(sandbox.path, 'project');
    await symlink('../outside/source.txt', join(root, 'linked.txt'));
    const refusal = matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' });
    expect(() => readText(root, 'linked.txt')).toThrow(refusal);
    expect(() => readBytes(createRunCache(root), 'linked.txt', { limit: 4 })).toThrow(refusal);
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
    expect(() => readBytes(cache, 'missing.txt')).toThrow(matchFields<NodeJS.ErrnoException>({ code: 'ENOENT' }));
    await writeFile(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readBytes(cache, 'missing.txt').toString()).toBe('recovered');
});
