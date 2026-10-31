import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { copyValePackages } from '#cli/runs/copy/vale.ts';

test('a revision copy whose .gspot is a link gets no Vale package link outside the copy', async () => {
    await using sandbox = await testdir({ 'work/.gspot/vale/styles/.keep': '', 'copy/.keep': '', 'outside/.keep': '' });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, 'copy/.gspot'), 'dir');
    expect(() => {
        copyValePackages(join(sandbox.path, 'work'), join(sandbox.path, 'copy'), []);
    }).toThrow('A parent of .gspot/vale is a link or is not a folder. Choose a folder without links.');
    expect(await isOnDisk(join(sandbox.path, 'outside/vale'))).toBe(false);
});
