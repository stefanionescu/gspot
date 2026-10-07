// The globs a folder scan takes: a pattern that leaves the folder is refused, and a link loop ends the walk.
import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { globPaths } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { mkdirSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';

test.each([
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
])('the pattern %s leaves its folder and is refused', async (pattern) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
    expect(() => globPaths(sandbox.path, ['src/**', pattern])).toThrow('cannot leave its folder');
});

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

test('hidden directories, finite patterns, exclusions, and case-sensitive matches retain their selections', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'src/a.ts': '',
        'src/.leaf.ts': '',
        'src/Case.TS': '',
        'src/nested/.inner/b.ts': '',
        '.hidden/nested/c.ts': '',
        'packages/.hidden/package.json': '',
        'packages/visible/package.json': '',
        'node_modules/.hidden/foreign.ts': '',
    });
    expect(globPaths(sandbox.path, 'src/**/*.ts').toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'src/a.ts',
    ]);
    expect(
        globPaths(sandbox.path, ['**/*.ts', '!node_modules/**'], { dot: true }).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(['.hidden/nested/c.ts', 'src/.leaf.ts', 'src/a.ts', 'src/nested/.inner/b.ts']);
    expect(
        globPaths(sandbox.path, 'packages/*', { dot: true, onlyFiles: false }).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(['packages/.hidden', 'packages/visible']);
    expect(
        globPaths(sandbox.path, ['src/{a.ts,nested/.inner/b.ts}', 'src/a.ts'], { dot: true }).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(['src/a.ts', 'src/nested/.inner/b.ts']);
});

test.skipIf(!isPosix)(
    'finite native queries keep link leaves and complete explicit aliases without entering loops',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/a.ts': '', 'src/deep/b.ts': '', 'src/.hidden/c.ts': '' });
        symlinkSync('src', join(sandbox.path, 'alias'), 'dir');
        symlinkSync('missing', join(sandbox.path, 'broken.ts'));
        symlinkSync('..', join(sandbox.path, 'src/.loop'), 'dir');
        expect(globPaths(sandbox.path, '*/*.ts').toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            'src/a.ts',
        ]);
        expect(globPaths(sandbox.path, '*').toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            'alias',
            'broken.ts',
        ]);
        expect(
            globPaths(sandbox.path, 'alias/**/*.ts', { dot: true, followSymlinks: true }).toSorted((left, right) =>
                left.localeCompare(right),
            ),
        ).toStrictEqual(['alias/.hidden/c.ts', 'alias/.loop/broken.ts', 'alias/a.ts', 'alias/deep/b.ts']);
        expect(
            globPaths(sandbox.path, ['**/*.ts', '!alias/**'], { dot: true, followSymlinks: true }).toSorted(
                (left, right) => left.localeCompare(right),
            ),
        ).toStrictEqual(['broken.ts', 'src/.hidden/c.ts', 'src/a.ts', 'src/deep/b.ts']);
    },
);
