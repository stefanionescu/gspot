import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as git from '#cli/system/git.ts';
import { test, spyOn, expect } from 'bun:test';
import { findRoot } from '#cli/repository/read.ts';

test('finding settings outside Git needs one Git lookup', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'deep/source.txt': 'source\n' });
    const run = git.runGitBlocking;
    using boundary = spyOn(git, 'runGitBlocking').mockImplementation((...commandArguments) => run(...commandArguments));
    expect(findRoot(join(sandbox.path, 'deep'))).toBe(sandbox.path);
    expect(boundary).toHaveBeenCalledTimes(1);
});
