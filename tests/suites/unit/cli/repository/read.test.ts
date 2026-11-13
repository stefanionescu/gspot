import { chmod, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { listRepositoryFiles, readLinguistPatterns, readRepositoryRoot } from '#cli/repository/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { DUBIOUS_GIT_ENVIRONMENT } from '#tests/config/repository.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { commitAll, runGitStep, stageUnmergedFile } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

test('inside Git, gspot takes the worktree root from a nested folder', async () => {
    await using sandbox = await createGitSandbox({ 'nested/source.ts': 'export {});\n' });

    expect(await readRepositoryRoot(join(sandbox.path, 'nested'))).toBe(sandbox.path);
});

test('a Git ownership refusal while finding the root stays a Git error', async () => {
    await using sandbox = await testdir({ 'source.txt': 'source\n' });
    commitAll(sandbox.path);
    using _environment = overrideEnvironment(DUBIOUS_GIT_ENVIRONMENT);
    const refused = runBlockingCommand(['git', 'rev-parse', '--show-toplevel'], {
        cwd: sandbox.path,
        env: DUBIOUS_GIT_ENVIRONMENT,
    });
    const error = await captureRejection(readRepositoryRoot(sandbox.path));
    expect(error).toMatchObject({ name: 'GspotError', code: 'git' });
    expect(error.message).toContain(refused.stderr.trim());
});

test('a broken Git index is a Git error', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    const cwd = sandbox.path;
    runGitStep(cwd, ['init']);
    runGitStep(cwd, ['add', 'source.ts']);
    const { files } = await listRepositoryFiles(createRunCache(cwd));
    expect(files.map((file) => file.path)).toStrictEqual(['source.ts']);
    await writeFile(join(cwd, '.git', 'index'), 'corrupt index');
    const error = await captureRejection(readTestRepository(cwd));
    expect(error).toMatchObject({ name: 'GspotError', code: 'git' });
});

test.skipIf(!isWindows)('on Windows the executable bit comes from the Git index', async () => {
    await using sandbox = await testdir({ 'indexed.sh': '#!/bin/sh\n', 'local.sh': '#!/bin/sh\n' });

    for (const commandArguments of [
        ['init', '-q'],
        ['add', '-A'],
        ['update-index', '--chmod=+x', 'indexed.sh'],
    ])
        runGitStep(sandbox.path, commandArguments);
    await chmod(join(sandbox.path, 'local.sh'), 0o700);
    const { files } = await listRepositoryFiles(createRunCache(sandbox.path));
    expect(files.map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
        { path: 'indexed.sh', executable: true },
        { path: 'local.sh', executable: false },
    ]);
});

test('an unmerged index lists each stage and keeps the working file readable', async () => {
    await using sandbox = await createGitSandbox({ 'source.txt': 'working content\n' });

    stageUnmergedFile(sandbox.path, 'source.txt');
    const { index } = await readTestRepository(sandbox.path);
    expect(index.map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    const { files } = await listRepositoryFiles(createRunCache(sandbox.path));
    expect(files).toMatchObject([
        { path: 'source.txt', size: Buffer.byteLength('working content\n'), executable: false, isSymlink: false },
    ]);
});

test('the index keeps deleted tracked paths and encoded names and leaves out untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await createGitSandbox({ [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['add', '--', path]);
    await rm(join(sandbox.path, path));
    const { index } = await readTestRepository(sandbox.path);
    expect(index.map((file) => file.path)).toStrictEqual([path]);
});

test('an invalid UTF-8 index name is reported separately from readable files', async () => {
    await using sandbox = await createGitSandbox({ 'valid.ts': 'export {};\n' });
    const hash = runGitStep(sandbox.path, ['hash-object', '-w', 'valid.ts']);
    runGitStep(sandbox.path, ['add', 'valid.ts']);
    const added = runBlockingCommand(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: `100644 ${hash}\t"\\377.ts"\n`,
    });
    expect(added.code, added.stderr).toBe(0);
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path }) => path)).toStrictEqual(['valid.ts']);
    expect(repository.unreadablePaths).toStrictEqual([String.raw`"\377.ts"`]);
});

test('a bare repository is refused with a Git error', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--bare', '--quiet']);
    const error = await captureRejection(readRepositoryRoot(sandbox.path));
    expect(error).toMatchObject({ name: 'GspotError', code: 'git' });
});

test('a tracked .gitattributes that is missing from the working tree is refused, not read as empty', async () => {
    await using sandbox = await testdir({ '.gitattributes': 'dist/** linguist-generated\n' });

    expect(() => readLinguistPatterns(createRunCache(sandbox.path), ['.gitattributes', 'app/.gitattributes'])).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: expect.stringContaining('app/.gitattributes') as string,
        }),
    );
});

test('a gitlink is a submodule path and not a tracked file', async () => {
    await using sandbox = await testdir({ 'source.txt': 'source\n' });
    await using outside = await testdir({ 'source.txt': 'outside source\n' });
    const commitId = commitAll(sandbox.path);
    const path = 'vendor/external project';
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},${path}`]);
    await mkdir(join(sandbox.path, 'vendor'));
    await symlink(outside.path, join(sandbox.path, path), 'dir');
    const { index, files } = await readTestRepository(sandbox.path);
    expect(listSubmodulePaths(index)).toStrictEqual([path]);
    expect(files.map((file) => file.path)).toStrictEqual(['source.txt']);
});
