import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { mkdir, readdir, symlink } from 'node:fs/promises';
import { checkOutRevision } from '#cli/execution/copy/public.ts';
import { readIndexEntries, getSubmodulePaths } from '#cli/repository/contracts.ts';

test.each(['index', 'commit'] as const)(
    'a %s copy retains gitlinks without reading submodule contents',
    async (kind) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([]),
            'source.txt': 'selected source',
        });
        await createFileTree(outside.path, { 'package.json': '{', 'source.txt': 'outside source' });
        gitOutput(sandbox.path, ['init']);
        gitOutput(sandbox.path, ['add', '.']);
        gitOutput(sandbox.path, ['commit', '-qm', 'Source']);
        const commitId = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        const path = 'vendor/external project';
        gitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},${path}`]);
        gitOutput(sandbox.path, ['commit', '-qm', 'Gitlink']);
        await mkdir(join(sandbox.path, 'vendor'));
        await symlink(outside.path, join(sandbox.path, path), 'dir');
        expect(getSubmodulePaths(await readIndexEntries(sandbox.path))).toStrictEqual([path]);
        const session = await openSession(sandbox.path);
        expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
        const expected = gitOutput(sandbox.path, ['write-tree']);
        const source = kind === 'index' ? { kind } : { kind, hash: gitOutput(sandbox.path, ['rev-parse', 'HEAD']) };
        await checkOutRevision(sandbox.path, source, async (copy, tree) => {
            expect(tree).toBe(expected);
            expect(gitOutput(copy, ['write-tree'])).toBe(expected);
            expect(await readdir(join(copy, path))).toStrictEqual([]);
            expect(await Bun.file(join(copy, 'source.txt')).text()).toBe('selected source');
            expect(getSubmodulePaths(await readIndexEntries(copy))).toStrictEqual([path]);
        });
        expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{');
        expect(await Bun.file(join(outside.path, 'source.txt')).text()).toBe('outside source');
    },
);
