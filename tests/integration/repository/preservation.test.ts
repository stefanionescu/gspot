import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { plant } from '#tests/support/cli/preservation.ts';
import { treeContents } from '#tests/support/cli/contents.ts';
import { chmodSync, lstatSync, readFileSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';

test('preservation captures distinguish symlink targets without following linked contents', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { one: Buffer.from([0, 255]), two: Buffer.from([0, 255]) });
    symlinkSync(join(outside.path, 'one'), join(sandbox.path, 'link'));
    const before = treeContents(sandbox.path);
    await Bun.write(join(outside.path, 'one'), 'changed outside');
    expect(treeContents(sandbox.path)).toStrictEqual(before);
    unlinkSync(join(sandbox.path, 'link'));
    symlinkSync(join(outside.path, 'two'), join(sandbox.path, 'link'));
    expect(treeContents(sandbox.path)).not.toStrictEqual(before);
});

test('planted changes restore binary bytes, modes, and dangling symlink identity', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.bin': Buffer.from([0, 255, 128]),
    });
    chmodSync(join(sandbox.path, 'source.bin'), 0o640);
    symlinkSync('missing-target', join(sandbox.path, 'link'));
    const before = treeContents(sandbox.path);
    const restore = plant(sandbox.path, {
        check: 'fixture/preservation',
        files: { 'source.bin': 'changed', link: 'temporary' },
        executable: ['source.bin'],
    });
    expect(lstatSync(join(sandbox.path, 'link')).isSymbolicLink()).toBe(false);
    restore();
    expect(treeContents(sandbox.path)).toStrictEqual(before);
    expect(readFileSync(join(sandbox.path, 'source.bin'))).toStrictEqual(Buffer.from([0, 255, 128]));
    expect(readlinkSync(join(sandbox.path, 'link'))).toBe('missing-target');
});
