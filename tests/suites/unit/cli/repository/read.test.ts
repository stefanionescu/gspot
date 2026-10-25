import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as git from '#cli/system/git.ts';
import { test, spyOn, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { runGit, commitAll } from '#tests/setup/system/git.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { DUBIOUS_GIT_ENVIRONMENT } from '#tests/config/repository/read.ts';

test('finding settings outside Git needs one Git lookup', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'deep/source.txt': 'source\n' });
    const run = git.runGitBlocking;
    using boundary = spyOn(git, 'runGitBlocking').mockImplementation((...commandArguments) => run(...commandArguments));
    expect(readRepositoryRoot(join(sandbox.path, 'deep'))).toBe(sandbox.path);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('a Git ownership refusal while finding the root stays a Git error', async () => {
    await using sandbox = await testdir({ 'source.txt': 'source\n' });
    commitAll(sandbox.path);
    using _environment = overrideEnvironment(DUBIOUS_GIT_ENVIRONMENT);
    const refused = runGit(sandbox.path, ['rev-parse', '--show-toplevel'], DUBIOUS_GIT_ENVIRONMENT);
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
