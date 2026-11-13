import { symlink, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listRepositoryFiles } from '#cli/repository/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { compareText } from '#cli/system/text.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

test('the repository file list leaves out a link to a file outside the repository', async () => {
    await using sandbox = await testdir({
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await symlink('../outside/secret.ts', join(root, 'linked.ts'));
    runGitStep(root, ['add', '--', 'linked.ts']);
    const repository = await readTestRepository(root);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
});

test('a dangling link is listed only when Git tracks it, without reading the file it points to', async () => {
    await using sandbox = await createGitSandbox({});
    await symlink('missing.ts', join(sandbox.path, 'tracked.ts'), 'file');
    await symlink('missing.ts', join(sandbox.path, 'untracked.ts'), 'file');
    runGitStep(sandbox.path, ['add', 'tracked.ts']);
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path, kind, tags }) => ({ path, kind, tags }))).toStrictEqual([
        { path: 'tracked.ts', kind: 'source', tags: ['typescript', 'text', 'symlink'] },
    ]);
});

test.each(
    [
        { name: 'a nested folder', folder: 'nested' },
        { name: 'a folder whose name holds a newline', folder: 'source\nfiles' },
    ].filter(({ folder }) => !isWindows || !folder.includes('\n')),
)('Git discovery in $name leaves out an ignored file and a folder link, and lists a file link', async ({ folder }) => {
    await using sandbox = await createGitSandbox({
        '.gitignore': '*.log\n',
        'source.ts': 'source',
        'root.log': 'ignored',
        [`${folder}/local.ts`]: 'retained',
    });
    await symlink('source.ts', join(sandbox.path, 'linked.ts'));
    await symlink(folder, join(sandbox.path, 'linked-directory'), 'dir');
    const { files } = await listRepositoryFiles(createRunCache(sandbox.path));
    expect(files.map((file) => file.path)).toStrictEqual(
        ['.gitignore', `${folder}/local.ts`, 'linked.ts', 'source.ts'].toSorted(compareText),
    );
    expect(files.find(({ path }) => path === 'linked.ts')).toMatchObject({
        path: 'linked.ts',
        size: Buffer.byteLength('source'),
        executable: false,
        isSymlink: true,
    });
});

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
