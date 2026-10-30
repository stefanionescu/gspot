import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isGitRepository } from '#cli/system/git.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a bare repository is refused with a work tree instruction', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--bare', '--quiet']);
    expect(() => isGitRepository(sandbox.path)).toThrow(
        `${sandbox.path} is a bare repository or a Git folder, not a work tree. Run gspot in the work tree.`,
    );
});
