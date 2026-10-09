import * as fs from 'node:fs';
import { join } from 'node:path';
import { throws } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readRepository } from '#cli/repository/public.ts';
import { readText, readPrefix, readSource, createReadCache } from '#cli/platform/root/public.ts';
import { rm, link, mkdir, unlink, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

test('source reads distinguish missing optional text, required bytes, and invalid UTF-8', async () => {
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

test('authored text follows file and directory links inside its root and reads hard-linked content', async () => {
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

test('source reads refuse a link chain outside its root and succeed after the link is corrected', async () => {
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

test('run-owned reads hold one repository snapshot and uncached reads observe later edits', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await createFileTree(first.path, { 'source.txt': 'first' });
    await createFileTree(second.path, { 'source.txt': 'second' });
    const reads = createReadCache(first.path);
    expect(readText(first.path, 'source.txt', reads)).toBe('first');
    await writeFile(join(first.path, 'source.txt'), 'edited');
    expect(readText(first.path, 'source.txt', reads)).toBe('first');
    expect(readText(first.path, 'source.txt')).toBe('edited');
    expect(readText(second.path, 'source.txt', reads)).toBe('second');
    expect(reads.sources.get('source.txt')).toStrictEqual(Buffer.from('first'));
});

test('canonical reads resolve an aliased root once and retain source errors until correction', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'project/source.txt': 'original', 'project/gspot.toml': buildPolicy([]) });
    const alias = join(directory.path, 'alias');
    await symlink('project', alias, 'dir');
    using resources = new DisposableStack();
    const paths = resources.use(spyOn(fs, 'realpathSync'));
    const reads = createReadCache(alias);
    expect(reads.root).toBe(await realpath(join(directory.path, 'project')));
    expect(readPrefix(reads.root, 'source.txt', 4, reads).toString()).toBe('orig');
    expect(readSource(reads.root, 'source.txt', reads).toString()).toBe('original');
    expect(paths.mock.calls.filter(([path]) => path === alias)).toHaveLength(1);
    const session = await openSession(alias);
    expect(session.root).toBe(reads.root);
    for (const code of ['EIO', 'EACCES']) {
        const failure = Object.assign(new Error('Source read failed.'), { code });
        reads.sources.clear();
        const unavailable = resources.use(
            spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
                throw failure;
            }),
        );
        throws(
            () => readSource(reads.root, 'source.txt', reads),
            (error) => error === failure,
        );
        expect(reads.sources.has('source.txt')).toBe(false);
        unavailable.mockRestore();
        expect(readSource(reads.root, 'source.txt', reads).toString()).toBe('original');
    }
});

test('source reads refuse an escape introduced after inventory and accept an internal replacement', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/source.ts': 'export const value = 1;\n',
        'outside.ts': 'external content',
    });
    const root = join(sandbox.path, 'project');
    const repository = await readRepository(root, [], [], []);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['source.ts']);
    await unlink(join(root, 'source.ts'));
    await symlink('../outside.ts', join(root, 'source.ts'));
    expect(() => readSource(root, repository.files[0]!.path)).toThrow('Source link leaves the repository');
    expect(() => readSource(root, '../outside.ts')).toThrow('Unsafe lifecycle path');
    await unlink(join(root, 'source.ts'));
    await Bun.write(join(root, 'owned.ts'), 'export const value = 2;\n');
    await symlink('owned.ts', join(root, 'source.ts'));
    expect(readSource(root, 'source.ts').toString('utf8')).toBe('export const value = 2;\n');
});

test('source reads never cache isolated output or turn failed reads into success', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    await createFileTree(scratch.path, { 'source.txt': 'before generation' });
    const reads = { root: sandbox.path, sources: new Map<string, Buffer>(), memo: new Map() };
    expect(readSource(sandbox.path, 'source.txt', reads).toString()).toBe('original');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('before generation');
    await Bun.write(join(scratch.path, 'source.txt'), 'after generation');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('after generation');
    expect(() => readSource(sandbox.path, 'missing.txt', reads)).toThrow('missing.txt');
    await Bun.write(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readSource(sandbox.path, 'missing.txt', reads).toString()).toBe('recovered');
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('original');
});

test.each([
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
])('source discovery leaves out the external %s link before inspection', async (name, target) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });
    const root = join(directory.path, 'project');
    gitOutput(root, ['init', '-q']);
    await symlink(target, join(root, name));
    gitOutput(root, ['add', '--', name]);
    const repository = await readRepository(root, [], [], []);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    expect(() => readPrefix(root, name, 64)).toThrow('Source link leaves the repository');
    await unlink(join(root, name));
    gitOutput(root, ['rm', '--cached', '--', name]);
    await symlink('local.ts', join(root, 'linked.ts'));
    gitOutput(root, ['add', 'linked.ts']);
    const corrected = await readRepository(root, [], [], []);
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toContain('symlink');
    expect(readPrefix(root, 'linked.ts', 64).toString('utf8')).toBe('export const local = true;\n');
});
