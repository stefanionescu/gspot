import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { isGitRepository } from '#cli/system/git.ts';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { findRoot, readRepository } from '#cli/repository/read.ts';
import { rm, chmod, unlink, symlink, writeFile } from 'node:fs/promises';
import { listRevisionEntries } from '#cli/repository/revisions/tree-entries.ts';
import { readIndexEntries, listTrackedFiles } from '#cli/repository/tracked.ts';
import { isWindows, useOperatingSystem } from '#tests/setup/operating-systems.ts';

test.each([
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
])('the repository file list leaves out the outside link %s', async (name, target) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });
    const root = join(directory.path, 'project');
    gitOutput(root, ['init', '-q']);
    await symlink(target, join(root, name));
    gitOutput(root, ['add', '--', name]);
    const repository = await readRepository(createReadCache(root), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    await unlink(join(root, name));
    gitOutput(root, ['rm', '--cached', '--', name]);
    await symlink('local.ts', join(root, 'linked.ts'));
    gitOutput(root, ['add', 'linked.ts']);
    const corrected = await readRepository(createReadCache(root), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toContain('symlink');
});

// Windows does not provide the POSIX named pipe created by mkfifo.
test.skipIf(isWindows)('a walk without Git leaves out named pipes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.spawnProcessBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const entries = await listTrackedFiles(sandbox.path, [], { hasGit: false });
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
});

test('deleted tracked files are left out of the file list', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'source.ts']);
    await rm(join(sandbox.path, 'source.ts'));
    expect(await listTrackedFiles(sandbox.path, await readIndexEntries(sandbox.path), { hasGit: true })).toStrictEqual(
        [],
    );
});

test('a dangling tracked link is listed without reading its target', async () => {
    await using sandbox = await testdir();
    await symlink('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'linked.ts']);
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    expect(repository.files).toHaveLength(1);
    expect(repository.files[0]?.tags).toContain('symlink');
    expect(repository.files[0]?.kind).toBe('source');
});

test('a broken Git index is reported instead of a folder walk', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    const cwd = sandbox.path;
    gitOutput(cwd, ['init']);
    expect(isGitRepository(cwd)).toBe(true);
    gitOutput(cwd, ['add', 'source.ts']);
    const entries = await listTrackedFiles(cwd, await readIndexEntries(cwd), { hasGit: true });
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
    await writeFile(join(cwd, '.git', 'index'), 'corrupt index');
    expect(await rejection(readIndexEntries(cwd))).toContain('Git ls-files failed');
});

test('invalid Git metadata is reported instead of treating the folder as non-Git', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.git': 'gitdir: missing\n',
        'source.ts': 'export {};\n',
    });
    expect(await rejection(readIndexEntries(sandbox.path))).toContain('Git ls-files failed');
    expect(() => findRoot(sandbox.path)).toThrow('Git root discovery failed');
    expect(() => isGitRepository(sandbox.path)).toThrow('Git work-tree discovery failed');
});

test('a missing git program is reported instead of a successful walk', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    await using empty = await testdir();
    using resources = new DisposableStack();
    resources.use(useEnvironment({ PATH: empty.path }));
    expect(await rejection(readIndexEntries(sandbox.path))).toMatch(
        /Git ls-files failed.*(?:not found|not recognized)/su,
    );
    expect(() => findRoot(sandbox.path)).toThrow(/Git root discovery failed.*(?:not found|not recognized)/su);
    expect(() => isGitRepository(sandbox.path)).toThrow(
        /Git work-tree discovery failed.*(?:not found|not recognized)/su,
    );
});

test('on Windows the executable bit comes from the Git index', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'indexed.sh': '#!/bin/sh\n', 'local.sh': '#!/bin/sh\n' });
    for (const argv of [
        ['init', '-q'],
        ['add', '-A'],
        ['update-index', '--chmod=+x', 'indexed.sh'],
    ])
        gitOutput(sandbox.path, argv);
    // Only the file system knows this bit, and Windows file systems keep none.
    await chmod(join(sandbox.path, 'local.sh'), 0o700);
    using resources = new DisposableStack();
    resources.use(useOperatingSystem('win32'));
    const entries = await listTrackedFiles(sandbox.path, await readIndexEntries(sandbox.path), { hasGit: true });
    expect(entries.map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
        { path: 'indexed.sh', executable: true },
        { path: 'local.sh', executable: false },
    ]);
});

test('an unmerged index keeps the working file readable but refuses a staged revision', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'working content\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    const hash = gitOutput(sandbox.path, ['hash-object', '-w', 'source.txt']);
    const update = runCommandBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\tsource.txt\n`).join(''),
    });
    expect(update.code, update.stderr).toBe(0);
    const index = await readIndexEntries(sandbox.path);
    expect(index.map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    expect(await listTrackedFiles(sandbox.path, index, { hasGit: true })).toStrictEqual([
        { path: 'source.txt', size: Buffer.byteLength('working content\n'), executable: false, symlink: false },
    ]);
    expect(await rejection(listRevisionEntries(sandbox.path, { kind: 'index' }))).toContain('Resolve index conflicts');
});

// Windows file names cannot hold a newline.
for (const folder of ['nested', 'source\nfiles'])
    test.skipIf(isWindows && folder.includes('\n'))(
        `non-Git discovery in ${JSON.stringify(folder)} applies nested ignores, pruning and link boundaries without sharing them with siblings`,
        async () => {
            await using sandbox = await testdir();
            const root = join(sandbox.path, 'project');
            await createFileTree(root, {
                '.gitignore': '*.log\nblocked/\n',
                'source.ts': 'source',
                'root.log': 'ignored',
                'blocked/.gitignore': '!inside.ts\n',
                'blocked/inside.ts': 'ignored directory',
                [`${folder}/.gitignore`]: '!keep.log\nlocal.ts\n',
                [`${folder}/keep.log`]: 'retained',
                [`${folder}/other.log`]: 'ignored',
                [`${folder}/local.ts`]: 'ignored',
                [`${folder}/deeper/keep.log`]: 'retained by inherited override',
                'sibling/keep.log': 'ignored by root',
                'sibling/local.ts': 'retained',
                '.gspot/state/private.txt': 'ownership metadata',
            });
            await createFileTree(sandbox.path, { 'outside/private.ts': 'external bytes' });
            await symlink('source.ts', join(root, 'linked.ts'));
            await symlink('../../outside', join(root, 'blocked/external'), 'dir');
            await symlink(folder, join(root, 'linked-directory'), 'dir');
            const entries = await listTrackedFiles(root, [], { hasGit: false });
            expect(entries.map((entry) => entry.path)).toStrictEqual(
                [
                    '.gitignore',
                    `${folder}/.gitignore`,
                    `${folder}/deeper/keep.log`,
                    `${folder}/keep.log`,
                    'sibling/local.ts',
                    'source.ts',
                ].toSorted((left, right) => left.localeCompare(right)),
            );
            await symlink('../outside/private.ts', join(root, 'external.ts'));
            const linked = await listTrackedFiles(root, [], { hasGit: false });
            expect(linked.map((entry) => entry.path)).toStrictEqual(entries.map((entry) => entry.path));
        },
    );

test('the index keeps deleted tracked paths and encoded names and leaves out untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '--', path]);
    await rm(join(sandbox.path, path));
    const entries = await readIndexEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
});
