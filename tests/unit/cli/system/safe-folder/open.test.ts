import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';

test('rmdir refuses linked and outside parents and keeps folders that are not empty', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/kept/value': 'external' });
    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    using files = openSafeFolder(root);
    expect(() => {
        files.rmdir('linked/kept');
    }).toThrow('is a link or is not a directory');
    expect(() => {
        files.rmdir('../outside/kept');
    }).toThrow('is not a safe repository-relative path');
    files.mkdir('cache/empty', 0o700);
    files.rmdir('cache/empty');
    expect(files.stat('cache/empty')).toBeUndefined();
    files.write('cache/kept/value', { bytes: Buffer.from('retained'), mode: 0o600 }, undefined);
    expect(() => {
        files.rmdir('cache/kept');
    }).toThrow('ENOTEMPTY');
    expect(files.read('cache/kept/value')?.bytes.toString()).toBe('retained');
    expect(await readFile(join(sandbox.path, 'outside/kept/value'), 'utf8')).toBe('external');
});
