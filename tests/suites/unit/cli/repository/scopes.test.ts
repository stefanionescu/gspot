import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { detectScopeFolders, findProjectFolder, joinScopeGlob, listOwnFiles } from '#cli/repository/scopes.ts';
import { listWorkspaceFolders } from '#cli/repository/workspaces.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { compareText } from '#cli/system/text.ts';
import {
    PRIVATE_TOOL_PACKAGES,
    PROJECT_FILE_FOLDERS,
    PROJECT_SCOPE_FILES,
    PROJECT_SCOPES,
    TOOL_ONLY_PACKAGES,
} from '#tests/config/repository/setup.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test.each(PROJECT_FILE_FOLDERS)('%s with the project file %s marks the folder %j', (path, pattern, folder) => {
    expect(findProjectFolder(path, pattern)).toBe(folder);
});

test('joinScopeGlob escapes the glob characters of the scope path', () => {
    expect(joinScopeGlob('app[1]', '**/*.ts')).toBe(String.raw`app\[1\]/**/*.ts`);
    expect(joinScopeGlob('', '**/*.ts')).toBe('**/*.ts');
});

test('listOwnFiles keeps the files whose deepest scope is the named one', () => {
    const files = [{ path: 'root.ts' }, { path: 'app/source.ts' }, { path: 'app/child/source.ts' }];
    const scopes = [{ path: '' }, { path: 'app' }, { path: 'app/child' }];
    expect(listOwnFiles(files, scopes, 'app')).toStrictEqual([{ path: 'app/source.ts' }]);
    expect(listOwnFiles(files, scopes, '')).toStrictEqual([{ path: 'root.ts' }]);
});

test('broad workspace patterns skip .gspot/.venv and its outside interpreter link', async () => {
    await using sandbox = await createGitSandbox(PRIVATE_TOOL_PACKAGES);

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await symlink('../../../../outside/python', join(root, `${GSPOT_PATHS.pythonEnvironment}/bin/python`));
    const repository = await readTestRepository(root);
    expect(listWorkspaceFolders(root)).toStrictEqual(['packages/app']);
    const folders = detectScopeFolders(
        repository.files,
        await readDependencyFiles(createRunCache(root), repository.files),
        readConfigurations().values(),
    ).map((scope) => scope.path);
    expect(folders).toStrictEqual(['packages/app']);
});

test('every folder that holds a project file is a scope, the root and lint-only packages aside', async () => {
    await using sandbox = await createGitSandbox(PROJECT_SCOPE_FILES);

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    const found = detectScopeFolders(repository.files, dependencyFiles, readConfigurations().values());
    expect(found.map((scope) => [scope.path, scope.origin])).toStrictEqual([...PROJECT_SCOPES]);
});

test('scope detection leaves out packages that hold only gspot npm tools or a hook manager, and keeps unpinned packages', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        ...TOOL_ONLY_PACKAGES,
    });
    const repository = await readTestRepository(sandbox.path);
    expect(listWorkspaceFolders(sandbox.path).toSorted(compareText)).toStrictEqual([
        'packages/custom',
        'packages/hooks',
        'packages/next',
        'packages/process',
    ]);
    const folders = detectScopeFolders(
        repository.files,
        await readDependencyFiles(createRunCache(sandbox.path), repository.files),
        readConfigurations().values(),
    ).map((scope) => scope.path);
    expect(folders).toStrictEqual(['packages/custom', 'packages/process']);
    await writeFile(
        join(sandbox.path, 'packages/next/package.json'),
        '{"dependencies":{"next":"16.0.0"},"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    );
    const corrected = await readTestRepository(sandbox.path);
    const correctedFolders = detectScopeFolders(
        corrected.files,
        await readDependencyFiles(createRunCache(sandbox.path), corrected.files),
        readConfigurations().values(),
    ).map((scope) => scope.path);
    expect(correctedFolders).toStrictEqual(['packages/custom', 'packages/next', 'packages/process']);
});
