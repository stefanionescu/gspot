import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createFileTree, type DirectoryJSON, testdir, type TestdirResult } from 'testdirs';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import {
    BASH_SYNTAX_PUSH_CHECK,
    CHANGED_CONTEXT,
    HOOKS_SETTINGS,
    LFS_ATTRIBUTES,
    NESTED_SCOPE_FILES,
    PUSH_CONTENT,
    TEAMS_MIGRATION_PATH,
    TEAMS_TABLE_SQL,
} from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

export async function readPushWorkingTree(root: string): Promise<{ head: string; settings: string; changed: string }> {
    return {
        head: runGitStep(root, ['rev-parse', 'HEAD']),
        settings: await readFile(join(root, SETTINGS_FILE), 'utf8'),
        changed: await readFile(join(root, 'changed.sh'), 'utf8'),
    };
}

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

export async function createLfsRepository(): Promise<TestdirResult> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.gitattributes': LFS_ATTRIBUTES,
        'asset.bin': 'binary',
    });
    commitAll(sandbox.path);
    return sandbox;
}

export async function createMigrationHistory(): Promise<AsyncDisposable & { path: string }> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        [TEAMS_MIGRATION_PATH]: TEAMS_TABLE_SQL,
    });
    commitAll(sandbox.path);
    return sandbox;
}

export async function createGitSandbox(files: DirectoryJSON): Promise<TestdirResult> {
    const sandbox = await testdir(files);
    runGitStep(sandbox.path, ['init', '--quiet']);
    return sandbox;
}
