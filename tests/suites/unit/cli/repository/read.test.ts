import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as git from '#cli/system/git.ts';
import { test, spyOn, expect } from 'bun:test';
import { isGitRepository } from '#cli/system/git.ts';
import { rm, chmod, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { CONFIGURATIONS_SETTINGS } from '#tests/config/toml.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { listTrackedFiles } from '#cli/repository/files/tracked.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { DUBIOUS_GIT_ENVIRONMENT } from '#tests/config/repository/read.ts';
import { buildProcessResult, runCommandBlocking } from '#tests/setup/system/processes.ts';
import { SHA256, INDEX_PATH, INDEX_LINE_FAILURE, INVALID_INDEX_LINES } from '#tests/config/parsers/git.ts';

test('finding settings outside Git needs one Git lookup', async () => {
    await using sandbox = await testdir({ 'gspot.toml': CONFIGURATIONS_SETTINGS, 'deep/source.txt': 'source\n' });
    const run = git.runGitBlocking;
    using boundary = spyOn(git, 'runGitBlocking').mockImplementation((...commandArguments) => run(...commandArguments));
    expect(readRepositoryRoot(join(sandbox.path, 'deep'))).toBe(sandbox.path);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('a Git ownership refusal while finding the root stays a Git error', async () => {
    await using sandbox = await testdir({ 'source.txt': 'source\n' });
    commitAll(sandbox.path);
    using _environment = overrideEnvironment(DUBIOUS_GIT_ENVIRONMENT);
    const refused = runCommandBlocking(['git', 'rev-parse', '--show-toplevel'], {
        cwd: sandbox.path,
        env: DUBIOUS_GIT_ENVIRONMENT,
    });
    expect(refused.code).toBe(128);
    expect(refused.stderr).toStartWith('fatal: detected dubious ownership');
    const error = await captureRejection(Promise.try(() => readRepositoryRoot(sandbox.path)));
    expect(error).toMatchObject({
        name: 'GspotError',
        code: 'git',
        message: `Git could not open ${sandbox.path}: ${refused.stderr.trim()}`,
    });
});

test('a Git refusal while reading attributes stays a Git error', async () => {
    await using sandbox = await testdir({ 'source.txt': 'source\n' });
    commitAll(sandbox.path);
    const run = git.runGitBlocking;
    using _boundary = spyOn(git, 'runGitBlocking').mockImplementation((root, commandArguments, options) =>
        commandArguments[0] === 'check-attr'
            ? buildProcessResult({ code: 128, stderr: 'fatal: cannot read attributes\n' })
            : run(root, commandArguments, options),
    );
    const error = await captureRejection(readTestRepository(sandbox.path));
    expect(error).toMatchObject({
        name: 'GspotError',
        code: 'git',
        message: 'Git could not read the attributes: fatal: cannot read attributes',
    });
});

test('deleted tracked files are left out of the file list', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['add', 'source.ts']);
    await rm(join(sandbox.path, 'source.ts'));
    expect(
        await listTrackedFiles(sandbox.path, await readTestRepository(sandbox.path).then(({ index }) => index), {
            hasGit: true,
        }),
    ).toStrictEqual([]);
});

test('a broken Git index is reported instead of a folder walk', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    const cwd = sandbox.path;
    runGitStep(cwd, ['init']);
    expect(isGitRepository(cwd)).toBe(true);
    runGitStep(cwd, ['add', 'source.ts']);
    const files = await listTrackedFiles(cwd, await readTestRepository(cwd).then(({ index }) => index), {
        hasGit: true,
    });
    expect(files.map((file) => file.path)).toStrictEqual(['source.ts']);
    await writeFile(join(cwd, '.git', 'index'), 'corrupt index');
    const error = await captureRejection(readTestRepository(cwd));
    expect(error.message).toStartWith('Git ls-files failed');
});

test('a .git file that points at a missing folder is reported, not read as a folder without Git', async () => {
    await using sandbox = await testdir({
        '.git': 'gitdir: missing\n',
        'source.ts': 'export {};\n',
    });

    const listError = await captureRejection(readTestRepository(sandbox.path));
    expect(listError.message).toStartWith(`Git could not tell whether ${sandbox.path} is a work tree (exit 128):`);
    expect(() => readRepositoryRoot(sandbox.path)).toThrow(`Git could not open ${sandbox.path}:`);
    expect(() => isGitRepository(sandbox.path)).toThrow('is a work tree (exit 128)');
});

test('a missing git program is reported instead of a successful walk', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    await using empty = await testdir();
    using resources = new DisposableStack();
    resources.use(overrideEnvironment({ PATH: empty.path }));
    const missingGitError = await captureRejection(readTestRepository(sandbox.path));
    expect(missingGitError.message).toMatch(
        /Git could not tell whether .* is a work tree.*(?:not found|not recognized)/su,
    );
    expect(() => readRepositoryRoot(sandbox.path)).toThrow(/Git could not open [^:]*:.*(?:not found|not recognized)/su);
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
    resources.use(fakePlatform('win32'));
    const files = await listTrackedFiles(
        sandbox.path,
        await readTestRepository(sandbox.path).then(({ index }) => index),
        {
            hasGit: true,
        },
    );
    expect(files.map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
        { path: 'indexed.sh', executable: true },
        { path: 'local.sh', executable: false },
    ]);
});

test('an unmerged index keeps the working file readable but refuses a staged revision', async () => {
    await using sandbox = await createGitSandbox({ 'source.txt': 'working content\n' });

    const hash = runGitStep(sandbox.path, ['hash-object', '-w', 'source.txt']);
    const update = runCommandBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\tsource.txt\n`).join(''),
    });
    expect(update.code, update.stderr).toBe(0);
    const { index } = await readTestRepository(sandbox.path);
    expect(index.map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    expect(await listTrackedFiles(sandbox.path, index, { hasGit: true })).toStrictEqual([
        { path: 'source.txt', size: Buffer.byteLength('working content\n'), executable: false, isSymlink: false },
    ]);
    const error = await captureRejection(listRevisionFiles(sandbox.path, { kind: 'index' }));
    expect(error.message).toBe(INDEX_LINE_FAILURE);
});

test('the index keeps deleted tracked paths and encoded names and leaves out untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await createGitSandbox({ [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });

    runGitStep(sandbox.path, ['add', '--', path]);
    await rm(join(sandbox.path, path));
    const files = await readTestRepository(sandbox.path).then(({ index }) => index);
    expect(files.map((file) => file.path)).toStrictEqual([path]);
});

test('an invalid UTF-8 index name is reported separately from readable files', async () => {
    await using sandbox = await createGitSandbox({ 'valid.ts': 'export {};\n' });
    const hash = runGitStep(sandbox.path, ['hash-object', '-w', 'valid.ts']);
    runGitStep(sandbox.path, ['add', 'valid.ts']);
    const added = runCommandBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: `100644 ${hash}\t"\\377.ts"\n`,
    });
    expect(added.code, added.stderr).toBe(0);
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.map(({ path }) => path)).toStrictEqual(['valid.ts']);
    expect(repository.unreadablePaths).toStrictEqual([String.raw`"\377.ts"`]);
});

test.each([...INVALID_INDEX_LINES])(
    'an index listing is refused while reading the repository: $name',
    async ({ output }) => {
        await using sandbox = await createGitSandbox({});
        using _read = spyOn(git, 'runGitForBytes').mockResolvedValue({
            ...buildProcessResult(),
            stdout: Buffer.from(output),
        });
        const error = await captureRejection(readTestRepository(sandbox.path));
        expect(error.message).toBe(INDEX_LINE_FAILURE);
    },
);

test.each([0, 1])('reading a repository keeps index stage %i and the full object ID', async (stage) => {
    await using sandbox = await createGitSandbox({ [INDEX_PATH]: 'source\n' });
    const run = git.runGitForBytes;
    using _read = spyOn(git, 'runGitForBytes').mockImplementation((root, commandArguments, options) =>
        commandArguments.includes('--stage')
            ? Promise.resolve({
                  ...buildProcessResult(),
                  stdout: Buffer.from(`100755 ${SHA256} ${String(stage)}\t${INDEX_PATH}\0`),
              })
            : run(root, commandArguments, options),
    );
    const repository = await readTestRepository(sandbox.path);
    expect(repository.index).toStrictEqual([{ mode: '100755', hash: SHA256, path: INDEX_PATH, stage }]);
});
