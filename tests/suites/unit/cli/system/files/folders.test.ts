import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, unlink, symlink } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';

import {
    GLOB_FILES,
    OUTSIDE_PATTERNS,
    LINKED_CONFIG_FILES,
    LINKED_CONFIG_FOLDERS,
} from '#tests/config/system/files/folders.ts';

test.each([...OUTSIDE_PATTERNS])('a pattern that leaves the folder is refused: %s', async (pattern) => {
    await using sandbox = await testdir({ 'src/a.ts': 'export {};\n' });

    expect(() => listMatchingPaths(sandbox.path, ['src/**', pattern])).toThrow('cannot leave its folder');
});

test.skipIf(isWindows).each([...LINKED_CONFIG_FOLDERS])(
    'a glob does not walk through the link $link to reach $pattern',
    async ({ link, target, pattern }) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, 'project');
        const selected = '.config/sub/tool.toml';
        await createFileTree(sandbox.path, LINKED_CONFIG_FILES);
        await mkdir(dirname(join(root, link)), { recursive: true });
        await symlink(target, join(root, link), 'dir');
        expect(listMatchingPaths(root, pattern)).toStrictEqual([]);
        await unlink(join(root, link));
        await createFileTree(root, { [selected]: 'setting = "local"\n' });
        expect(listMatchingPaths(root, pattern)).toStrictEqual([selected]);
    },
);

test('a glob includes dot files and honors exclusions and brace patterns', async () => {
    await using sandbox = await testdir(GLOB_FILES);

    expect(
        listMatchingPaths(sandbox.path, 'src/**/*.ts').toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['src/.leaf.ts', 'src/a.ts', 'src/nested/.inner/b.ts']);
    expect(
        listMatchingPaths(sandbox.path, ['**/*.ts', '!node_modules/**']).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(['.hidden/nested/c.ts', 'src/.leaf.ts', 'src/a.ts', 'src/nested/.inner/b.ts']);
    expect(
        listMatchingPaths(sandbox.path, ['src/{a.ts,nested/.inner/b.ts}', 'src/a.ts']).toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(['src/a.ts', 'src/nested/.inner/b.ts']);
});

test.skipIf(isWindows)('a glob lists links as files and never enters them', async () => {
    await using sandbox = await testdir({ 'src/a.ts': '', 'src/deep/b.ts': '', 'src/.hidden/c.ts': '' });

    await symlink('src', join(sandbox.path, 'alias'), 'dir');
    await symlink('missing', join(sandbox.path, 'broken.ts'));
    await symlink('..', join(sandbox.path, 'src/.loop'), 'dir');
    expect(
        listMatchingPaths(sandbox.path, '*/*.ts').toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['src/a.ts']);
    expect(listMatchingPaths(sandbox.path, '*').toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'alias',
        'broken.ts',
    ]);
});
