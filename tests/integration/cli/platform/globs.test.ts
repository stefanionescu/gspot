// The globs a folder scan takes: a pattern that leaves the folder is refused, and a link loop ends the walk.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { globPaths } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { onPosix } from '#tests/harness/cli/platforms.ts';

test.each(['../outside/**', 'src/../../outside.ts', '/etc/**', 'C:/Windows/**', '!../outside/**'])(
    'the pattern %s leaves its folder and is refused',
    async (pattern) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
        expect(() => globPaths(sandbox.path, ['src/**', pattern])).toThrow('cannot leave its folder');
    },
);

if (onPosix)
    test('a walk that follows links ends at a link back to its own folder', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
        symlinkSync('..', join(sandbox.path, 'src/loop'));
        const paths = globPaths(sandbox.path, 'src/**/*.ts', { followSymlinks: true });
        expect(paths).toContain('src/a.ts');
        expect(paths.length).toBeLessThan(10);
    });
