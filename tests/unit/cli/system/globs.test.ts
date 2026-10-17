import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, unlink, symlink } from 'node:fs/promises';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { GLOB_FILES, OUTSIDE_PATTERNS, LINKED_MISE_FILES, LINKED_MISE_FOLDERS } from '#tests/data/system.ts';

test.each([...OUTSIDE_PATTERNS])('a pattern that leaves the folder is refused: %s', async (pattern) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/a.ts': 'export {};\n' });
    expect(() => listMatchingPaths(sandbox.path, ['src/**', pattern])).toThrow('cannot leave its folder');
});

// Windows symbolic links require privileges these tests do not request.
test.skipIf(isWindows).each([...LINKED_MISE_FOLDERS])(
    'a glob does not walk through the link $link to reach $pattern',
    async ({ link, target, pattern }) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, 'project');
        const selected = '.config/sub/tool.toml';
        await createFileTree(sandbox.path, LINKED_MISE_FILES);
        await mkdir(dirname(join(root, link)), { recursive: true });
        await symlink(target, join(root, link), 'dir');
        expect(listMatchingPaths(root, pattern)).toStrictEqual([]);
        await unlink(join(root, link));
        await createFileTree(root, { [selected]: 'setting = "local"\n' });
        expect(listMatchingPaths(root, pattern)).toStrictEqual([selected]);
    },
);

test('a glob includes dot files and honors exclusions and brace patterns', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, GLOB_FILES);
    expect(listSortedPaths(sandbox.path, 'src/**/*.ts')).toStrictEqual([
        'src/.leaf.ts',
        'src/a.ts',
        'src/nested/.inner/b.ts',
    ]);
    expect(listSortedPaths(sandbox.path, ['**/*.ts', '!node_modules/**'])).toStrictEqual([
        '.hidden/nested/c.ts',
        'src/.leaf.ts',
        'src/a.ts',
        'src/nested/.inner/b.ts',
    ]);
    expect(listSortedPaths(sandbox.path, ['src/{a.ts,nested/.inner/b.ts}', 'src/a.ts'])).toStrictEqual([
        'src/a.ts',
        'src/nested/.inner/b.ts',
    ]);
});

// Windows symbolic links require privileges these tests do not request.
test.skipIf(isWindows)('a glob lists links as files and never enters them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/a.ts': '', 'src/deep/b.ts': '', 'src/.hidden/c.ts': '' });
    await symlink('src', join(sandbox.path, 'alias'), 'dir');
    await symlink('missing', join(sandbox.path, 'broken.ts'));
    await symlink('..', join(sandbox.path, 'src/.loop'), 'dir');
    expect(listSortedPaths(sandbox.path, '*/*.ts')).toStrictEqual(['src/a.ts']);
    expect(listSortedPaths(sandbox.path, '*')).toStrictEqual(['alias', 'broken.ts']);
});

/** Sort matched paths so assertions do not depend on filesystem enumeration order. */
function listSortedPaths(root: string, patterns: string | string[]): string[] {
    return listMatchingPaths(root, patterns).toSorted((left, right) => left.localeCompare(right));
}
