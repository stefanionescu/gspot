import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text/order.ts';
import { mkdir, unlink, symlink } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { LINKED_GLOBS, OUTSIDE_PATTERNS } from '#tests/config/system.ts';

test.each([...OUTSIDE_PATTERNS])('a pattern that leaves the folder is refused: %s', async (pattern) => {
    await using sandbox = await testdir({ 'src/a.ts': 'export {};\n' });

    expect(() => listMatchingPaths(sandbox.path, ['src/**', pattern])).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'filesystem' }),
    );
});

test.skipIf(isWindows).each(LINKED_GLOBS)(
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
        expect(listMatchingPaths(root, [pattern])).toStrictEqual([]);
        await unlink(join(root, link));
        await createFileTree(root, { [selected]: 'setting = "local"\n' });
        expect(listMatchingPaths(root, [pattern])).toStrictEqual([selected]);
    },
);

test('a glob includes dot files and honors exclusions', async () => {
    await using sandbox = await testdir({
        'src/a.ts': '',
        'src/.leaf.ts': '',
        'src/Case.TS': '',
        'src/nested/.inner/b.ts': '',
        '.hidden/nested/c.ts': '',
        'node_modules/.hidden/foreign.ts': '',
    });

    expect(listMatchingPaths(sandbox.path, ['src/**/*.ts']).toSorted(compareText)).toStrictEqual([
        'src/.leaf.ts',
        'src/a.ts',
        'src/nested/.inner/b.ts',
    ]);
    expect(
        listMatchingPaths(sandbox.path, ['**/*.ts', '!node_modules/**']).toSorted((left, right) =>
            compareText(left, right),
        ),
    ).toStrictEqual(['.hidden/nested/c.ts', 'src/.leaf.ts', 'src/a.ts', 'src/nested/.inner/b.ts']);
});

test.skipIf(isWindows)('a glob excludes file, folder, broken, and cyclic links', async () => {
    await using sandbox = await testdir({ 'src/a.ts': '', 'src/deep/b.ts': '', 'src/.hidden/c.ts': '' });

    await symlink('src', join(sandbox.path, 'alias'), 'dir');
    await symlink('missing', join(sandbox.path, 'broken.ts'));
    await symlink('src/a.ts', join(sandbox.path, 'link.ts'));
    await symlink('..', join(sandbox.path, 'src/.loop'), 'dir');
    expect(listMatchingPaths(sandbox.path, ['*/*.ts']).toSorted(compareText)).toStrictEqual(['src/a.ts']);
    expect(listMatchingPaths(sandbox.path, ['*'])).toStrictEqual([]);
});
