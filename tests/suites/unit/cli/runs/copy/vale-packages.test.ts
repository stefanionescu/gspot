import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink, realpath } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { copyValePackages } from '#cli/runs/copy/vale-packages.ts';

test('a revision copy links the installed Vale packages into its own .gspot folder', async () => {
    await using sandbox = await testdir({ 'work/.gspot/vale/styles/.keep': '', 'copy/.keep': '' });
    const work = join(sandbox.path, 'work');
    copyValePackages(work, join(sandbox.path, 'copy'), []);
    expect(await realpath(join(sandbox.path, 'copy', GSPOT_PATHS.valePackages))).toBe(
        await realpath(join(work, GSPOT_PATHS.valePackages)),
    );
});

test('a revision copy whose .gspot is a link gets no Vale package link outside the copy', async () => {
    await using sandbox = await testdir({ 'work/.gspot/vale/styles/.keep': '', 'copy/.keep': '', 'outside/.keep': '' });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, 'copy/.gspot'), 'dir');
    expect(() => {
        copyValePackages(join(sandbox.path, 'work'), join(sandbox.path, 'copy'), []);
    }).toThrow('A parent of .gspot/vale is a link or is not a folder. Choose a folder without links.');
    expect(await isOnDisk(join(sandbox.path, 'outside/vale'))).toBe(false);
});
