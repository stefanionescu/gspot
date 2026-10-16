import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { mkdir, unlink, symlink } from 'node:fs/promises';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { OUTSIDE_PATTERNS, LINKED_MISE_FOLDERS } from '#tests/config/system.ts';

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
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/sub/tool.toml': 'setting = "external"\n',
        });
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

// Windows symbolic links require privileges these tests do not request.
test.skipIf(isWindows)('a glob lists links as files and never enters them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/a.ts': '', 'src/deep/b.ts': '', 'src/.hidden/c.ts': '' });
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
