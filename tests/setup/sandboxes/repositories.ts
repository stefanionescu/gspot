import { join } from 'node:path';
import { expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';

import {
    PUSH_CONTENT,
    HOOKS_SETTINGS,
    LFS_ATTRIBUTES,
    CHANGED_CONTEXT,
    TEAMS_TABLE_SQL,
    NESTED_SCOPE_FILES,
    TEAMS_MIGRATION_PATH,
    BASH_SYNTAX_PUSH_CHECK,
} from '#tests/config/setup/sandboxes.ts';

/**
Check that a push check left the HEAD commit, the settings, and the working-tree bytes of the push repository alone.
*/
export async function assertWorkingTreeKept(root: string, head: string): Promise<void> {
    expect(runGitStep(root, ['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.settings);
    expect(await readFile(join(root, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
}

/**
Create base, reviewed, and broken commits, plus different working-tree bytes, for the push tests, and return their
hashes with the zero hash of a new ref.
*/
export async function preparePushRepository(
    root: string,
): Promise<{ base: string; reviewed: string; broken: string; zero: string }> {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'changed.sh': PUSH_CONTENT.base,
        'legacy.sh': PUSH_CONTENT.broken,
    });
    const base = commitAll(root);
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.reviewed);
    const reviewed = commitAll(root, 'reviewed');
    runGitStep(root, ['branch', 'reviewed', reviewed]);
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.broken);
    const broken = commitAll(root, 'unreviewed');
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.working);
    await writeFile(join(root, SETTINGS_FILE), PUSH_CONTENT.settings);
    return { base, reviewed, broken, zero: '0'.repeat(base.length) };
}

/**
Create a repository with a nested scope whose source differs in the commit, the index, and the working tree.
*/
export async function prepareNestedRepository(
    root: string,
): Promise<{ project: string; base: string; commitId: string }> {
    await createFileTree(root, NESTED_SCOPE_FILES);
    const project = join(root, 'nested settings');
    const base = commitAll(root, 'Base');
    await writeFile(join(project, 'source.txt'), 'pushed');
    await writeFile(join(root, 'outside.txt'), CHANGED_CONTEXT);
    const commitId = commitAll(root, 'Change');
    await writeFile(join(project, 'source.txt'), 'indexed');
    runGitStep(root, ['add', '.']);
    await writeFile(join(project, 'source.txt'), 'working');
    return { project, base, commitId };
}

/**
Create a committed repository with hooks on and one file that Git Large File Storage (LFS) stores.
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

/**
Create a repository with a committed migration and freeze its migrations.
*/
export async function createMigrationHistory(): Promise<AsyncDisposable & { path: string }> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        [TEAMS_MIGRATION_PATH]: TEAMS_TABLE_SQL,
    });
    commitAll(sandbox.path);
    return sandbox;
}

/**
Create a sandbox from these files and make it a Git repository without commits.
*/
export async function createGitSandbox(files: DirectoryJSON): Promise<TestdirResult> {
    const sandbox = await testdir(files);
    runGitStep(sandbox.path, ['init', '--quiet']);
    return sandbox;
}
