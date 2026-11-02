import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { unlink, symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { createRunCache } from '#cli/system/cache.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { OUTSIDE_LINK_CASES } from '#tests/config/repository/files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
});

test.skipIf(isWindows)('the Git inventory leaves out untracked named pipes', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    expect(runBlockingCommand(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const { files } = await listRepositoryFiles(createRunCache(sandbox.path));
    expect(files.map((file) => file.path)).toStrictEqual(['source.ts']);
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

test('a dangling untracked link stays out of the inventory', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });
    await symlink('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path }) => path)).toStrictEqual(['source.ts']);
});

test.each(
    [
        { name: 'a nested folder', folder: 'nested' },
        { name: 'a folder whose name holds a newline', folder: 'source\nfiles' },
    ].filter(({ folder }) => !isWindows || !folder.includes('\n')),
)(
    'Git discovery in $name applies nested ignores, pruning and link boundaries without sharing them with siblings',
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
        });
        await createFileTree(sandbox.path, { 'outside/private.ts': 'external bytes' });
        await symlink('source.ts', join(root, 'linked.ts'));
        await symlink('../../outside', join(root, 'blocked/external'), 'dir');
        await symlink(folder, join(root, 'linked-directory'), 'dir');
        runGitStep(root, ['init', '-q']);
        const { files } = await listRepositoryFiles(createRunCache(root));
        expect(files.map((file) => file.path)).toStrictEqual(
            [
                '.gitignore',
                `${folder}/.gitignore`,
                `${folder}/deeper/keep.log`,
                `${folder}/keep.log`,
                'linked.ts',
                'sibling/local.ts',
                'source.ts',
            ].toSorted(compareText),
        );
        expect(files.find(({ path }) => path === 'linked.ts')).toMatchObject({
            path: 'linked.ts',
            size: Buffer.byteLength('source'),
            executable: false,
            isSymlink: true,
        });
        await symlink('../outside/private.ts', join(root, 'external.ts'));
        const linked = await listRepositoryFiles(createRunCache(root));
        expect(linked.files.map((file) => file.path)).toStrictEqual(files.map((file) => file.path));
    },
);

test.skipIf(isWindows)('tracked pipes and links to pipes are left out before reading bytes', async () => {
    await using sandbox = await createGitSandbox({ 'stream.ts': 'before' });
    runGitStep(sandbox.path, ['add', '.']);
    await unlink(join(sandbox.path, 'stream.ts'));
    expect(runBlockingCommand(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    await symlink('stream.ts', join(sandbox.path, 'linked.ts'));
    runGitStep(sandbox.path, ['add', 'linked.ts']);
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files).toStrictEqual([]);
});
