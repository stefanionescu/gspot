import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { findRoot } from '#cli/repository/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { isGitRepository } from '#cli/system/git.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { rm, chmod, unlink, symlink, writeFile } from 'node:fs/promises';
import { readIndexFiles, listTrackedFiles } from '#cli/repository/files/tracked.ts';
import { isWindows, simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { OUTSIDE_LINK_CASES, ROOT_DISCOVERY_CASES } from '#tests/config/repository/files/tracked.ts';

test.each([...ROOT_DISCOVERY_CASES])(
    'outside Git, gspot takes $name as the repository root',
    async ({ files, start }) => {
        await using sandbox = await testdir({ ...files, 'nested/source.ts': 'export {});\n' });

        expect(findRoot(join(sandbox.path, start))).toBe(sandbox.path);
    },
);
test.each([...OUTSIDE_LINK_CASES])('the repository file list leaves out the outside link %s', async (name, target) => {
    await using sandbox = await testdir({
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await symlink(target, join(root, name));
    runGitStep(root, ['add', '--', name]);
    const repository = await readTestRepository(root);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    await unlink(join(root, name));
    runGitStep(root, ['rm', '--cached', '--', name]);
    await symlink('local.ts', join(root, 'linked.ts'));
    runGitStep(root, ['add', 'linked.ts']);
    const corrected = await readTestRepository(root);
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toStrictEqual([
        'typescript',
        'text',
        'symlink',
    ]);
});
test.skipIf(isWindows)('a walk without Git leaves out named pipes', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    expect(runCommandBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const files = await listTrackedFiles(sandbox.path, [], { hasGit: false });
    expect(files.map((file) => file.path)).toStrictEqual(['source.ts']);
});
test('deleted tracked files are left out of the file list', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', 'source.ts']);
    await rm(join(sandbox.path, 'source.ts'));
    expect(await listTrackedFiles(sandbox.path, await readIndexFiles(sandbox.path), { hasGit: true })).toStrictEqual(
        [],
    );
});
test('a dangling tracked link is listed without reading the file it points to', async () => {
    await using sandbox = await testdir();
    await symlink('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', 'linked.ts']);
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path, kind, tags }) => ({ path, kind, tags }))).toStrictEqual([
        { path: 'linked.ts', kind: 'source', tags: ['typescript', 'text', 'symlink'] },
    ]);
});
test('a broken Git index is reported instead of a folder walk', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    const cwd = sandbox.path;
    runGitStep(cwd, ['init']);
    expect(isGitRepository(cwd)).toBe(true);
    runGitStep(cwd, ['add', 'source.ts']);
    const files = await listTrackedFiles(cwd, await readIndexFiles(cwd), { hasGit: true });
    expect(files.map((file) => file.path)).toStrictEqual(['source.ts']);
    await writeFile(join(cwd, '.git', 'index'), 'corrupt index');
    expect(await captureRejection(readIndexFiles(cwd))).toStartWith('Git ls-files failed');
});
test('a .git file that points at a missing folder is reported, not read as a folder without Git', async () => {
    await using sandbox = await testdir({
        '.git': 'gitdir: missing\n',
        'source.ts': 'export {};\n',
    });

    expect(await captureRejection(readIndexFiles(sandbox.path))).toStartWith('Git ls-files failed');
    expect(() => findRoot(sandbox.path)).toThrow('Git could not find the repository root of');
    expect(() => isGitRepository(sandbox.path)).toThrow('is a work tree (exit 128)');
});
test('a missing git program is reported instead of a successful walk', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    await using empty = await testdir();
    using resources = new DisposableStack();
    resources.use(overrideEnvironment({ PATH: empty.path }));
    expect(await captureRejection(readIndexFiles(sandbox.path))).toMatch(
        /Git ls-files failed.*(?:not found|not recognized)/su,
    );
    expect(() => findRoot(sandbox.path)).toThrow(
        /Git could not find the repository root of.*(?:not found|not recognized)/su,
    );
    expect(() => isGitRepository(sandbox.path)).toThrow(
        /Git could not tell whether .* is a work tree.*(?:not found|not recognized)/su,
    );
});
test('on Windows the executable bit comes from the Git index', async () => {
    await using sandbox = await testdir({ 'indexed.sh': '#!/bin/sh\n', 'local.sh': '#!/bin/sh\n' });

    for (const commandArguments of [
        ['init', '-q'],
        ['add', '-A'],
        ['update-index', '--chmod=+x', 'indexed.sh'],
    ])
        runGitStep(sandbox.path, commandArguments);
    await chmod(join(sandbox.path, 'local.sh'), 0o700);
    using resources = new DisposableStack();
    resources.use(simulateOperatingSystem('win32'));
    const files = await listTrackedFiles(sandbox.path, await readIndexFiles(sandbox.path), { hasGit: true });
    expect(files.map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
        { path: 'indexed.sh', executable: true },
        { path: 'local.sh', executable: false },
    ]);
});
test('an unmerged index keeps the working file readable but refuses a staged revision', async () => {
    await using sandbox = await testdir({ 'source.txt': 'working content\n' });

    runGitStep(sandbox.path, ['init', '-q']);
    const hash = runGitStep(sandbox.path, ['hash-object', '-w', 'source.txt']);
    const update = runCommandBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\tsource.txt\n`).join(''),
    });
    expect(update.code, update.stderr).toBe(0);
    const index = await readIndexFiles(sandbox.path);
    expect(index.map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    expect(await listTrackedFiles(sandbox.path, index, { hasGit: true })).toStrictEqual([
        { path: 'source.txt', size: Buffer.byteLength('working content\n'), executable: false, symlink: false },
    ]);
    expect(await captureRejection(listRevisionFiles(sandbox.path, { kind: 'index' }))).toContain(
        'Resolve index conflicts',
    );
});
test('the index keeps deleted tracked paths and encoded names and leaves out untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir({ [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '--', path]);
    await rm(join(sandbox.path, path));
    const files = await readIndexFiles(sandbox.path);
    expect(files.map((file) => file.path)).toStrictEqual([path]);
});
test.each(
    [
        { name: 'a nested folder', folder: 'nested' },
        { name: 'a folder whose name holds a newline', folder: 'source\nfiles' },
    ].filter(({ folder }) => !isWindows || !folder.includes('\n')),
)(
    'non-Git discovery in $name applies nested ignores, pruning and link boundaries without sharing them with siblings',
    async ({ folder }) => {
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
            [`${GSPOT_PATHS.state}/private.txt`]: 'ownership metadata',
        });
        await createFileTree(sandbox.path, { 'outside/private.ts': 'external bytes' });
        await symlink('source.ts', join(root, 'linked.ts'));
        await symlink('../../outside', join(root, 'blocked/external'), 'dir');
        await symlink(folder, join(root, 'linked-directory'), 'dir');
        const files = await listTrackedFiles(root, [], { hasGit: false });
        expect(files.map((file) => file.path)).toStrictEqual(
            [
                '.gitignore',
                `${folder}/.gitignore`,
                `${folder}/deeper/keep.log`,
                `${folder}/keep.log`,
                'linked.ts',
                'sibling/local.ts',
                'source.ts',
            ].toSorted((left, right) => left.localeCompare(right)),
        );
        expect(files.find(({ path }) => path === 'linked.ts')).toStrictEqual({
            path: 'linked.ts',
            size: Buffer.byteLength('source'),
            executable: false,
            symlink: true,
        });
        await symlink('../outside/private.ts', join(root, 'external.ts'));
        const linked = await listTrackedFiles(root, [], { hasGit: false });
        expect(linked.map((file) => file.path)).toStrictEqual(files.map((file) => file.path));
    },
);
