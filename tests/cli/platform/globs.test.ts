// The globs a folder scan takes: a pattern that leaves the folder is refused, and a link loop ends the walk.
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { globPaths } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { mkdirSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';

test.each(['../outside/**', 'src/../../outside.ts', '/etc/**', 'C:/Windows/**', '!../outside/**'])(
    'the pattern %s leaves its folder and is refused',
    async (pattern) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
        expect(() => globPaths(sandbox.path, ['src/**', pattern])).toThrow('cannot leave its folder');
    },
);

test.skipIf(!isPosix)('a walk that follows links ends at a link back to its own folder', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
    symlinkSync('..', join(sandbox.path, 'src/loop'));
    const paths = globPaths(sandbox.path, 'src/**/*.ts', { followSymlinks: true });
    expect(paths).toStrictEqual(['src/a.ts']);
});

test.skipIf(!isPosix).each([
    { link: '.mise', target: '../outside', pattern: '.mise/conf.d/*.toml' },
    { link: '.mise/conf.d', target: '../../outside/conf.d', pattern: '.mise/conf.d/*.toml' },
    { link: '.mise', target: '../outside', pattern: '.mise/conf.d/tool.toml' },
])('$link blocks $pattern until following is requested or the link is replaced', async ({ link, target, pattern }) => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const selected = '.mise/conf.d/tool.toml';
    await createFileTree(sandbox.path, {
        'project/source.ts': 'export {};\n',
        'outside/conf.d/tool.toml': 'setting = "external"\n',
    });
    mkdirSync(dirname(join(root, link)), { recursive: true });
    symlinkSync(target, join(root, link), 'dir');
    expect(globPaths(root, pattern, { followSymlinks: false })).toStrictEqual([]);
    expect(globPaths(root, pattern, { followSymlinks: true })).toStrictEqual([selected]);
    unlinkSync(join(root, link));
    await createFileTree(root, { [selected]: 'setting = "local"\n' });
    expect(globPaths(root, pattern, { followSymlinks: false })).toStrictEqual([selected]);
    expect(readFileSync(join(root, selected), 'utf8')).toBe('setting = "local"\n');
    expect(readFileSync(join(sandbox.path, 'outside/conf.d/tool.toml'), 'utf8')).toBe('setting = "external"\n');
    expect(readFileSync(join(root, 'source.ts'), 'utf8')).toBe('export {};\n');
});
