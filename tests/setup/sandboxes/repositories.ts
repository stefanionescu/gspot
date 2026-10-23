import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { HOOKS_SETTINGS } from '#tests/config/setup/cli.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/runs/command.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { PUSH_CONTENT, LFS_ATTRIBUTES, NESTED_SCOPE_FILES } from '#tests/config/setup/sandboxes.ts';

/**
 * Create base, reviewed, and broken commits, plus different working-tree bytes, for the push tests.
 *
 * @param sandboxRoot folder for the repository.
 * @returns the commit hashes and the zero hash for a new ref.
 */
export async function preparePushRepository(
    sandboxRoot: string,
): Promise<{ base: string; reviewed: string; broken: string; zero: string }> {
    await createFileTree(sandboxRoot, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': PUSH_CONTENT.base,
        'legacy.sh': PUSH_CONTENT.broken,
    });
    const base = commitAll(sandboxRoot);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.reviewed);
    const reviewed = commitAll(sandboxRoot, 'reviewed');
    runGitStep(sandboxRoot, ['branch', 'reviewed', reviewed]);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.broken);
    const broken = commitAll(sandboxRoot, 'unreviewed');
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.working);
    await writeFile(join(sandboxRoot, 'gspot.toml'), PUSH_CONTENT.settings);
    return { base, reviewed, broken, zero: '0'.repeat(base.length) };
}

/** Create a repository with a nested scope whose source differs in the commit, the index, and the working tree. */
export async function prepareNestedRepository(
    root: string,
): Promise<{ project: string; base: string; commitId: string }> {
    await createFileTree(root, NESTED_SCOPE_FILES);
    const project = join(root, 'nested settings');
    const base = commitAll(root, 'Fixture');
    await writeFile(join(project, 'source.txt'), 'pushed');
    await writeFile(join(root, 'outside.txt'), 'changed context');
    const commitId = commitAll(root, 'Change');
    await writeFile(join(project, 'source.txt'), 'indexed');
    runGitStep(root, ['add', '.']);
    await writeFile(join(project, 'source.txt'), 'working');
    return { project, base, commitId };
}

/**
 * Create a committed repository with hooks on and one file that Git Large File Storage (LFS) stores.
 *
 * @returns the sandbox, which removes itself on disposal.
 */
export async function createLfsRepository(): Promise<TestdirResult> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.gitattributes': LFS_ATTRIBUTES,
        'asset.bin': 'binary',
    });
    commitAll(sandbox.path);
    return sandbox;
}
