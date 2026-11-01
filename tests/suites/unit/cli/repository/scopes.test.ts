import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { symlink, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { buildArgumentPath, findProjectFolder, detectScopeFolders } from '#cli/repository/scopes.ts';

import {
    PROJECT_SCOPES,
    TOOL_ONLY_PACKAGES,
    PROJECT_SCOPE_FILES,
    PROJECT_FILE_FOLDERS,
    WORKSPACE_FILE_CASES,
    PRIVATE_TOOL_PACKAGES,
} from '#tests/config/repository/repository.ts';

test.each(PROJECT_FILE_FOLDERS)('%s with the project file %s marks the folder %j', (path, pattern, folder) => {
    expect(findProjectFolder(path, pattern)).toBe(folder);
});

test.each([...WORKSPACE_FILE_CASES])(
    'workspace files list tool packages while scope detection keeps applications: %j',
    async (files) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
            'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
        });

        const repository = await readTestRepository(sandbox.path);
        expect(listWorkspaceFolders(sandbox.path).toSorted(compareText)).toStrictEqual([
            'packages/api',
            'packages/lint',
        ]);
        const scopes = detectScopeFolders(
            repository.files,
            await readDependencyFiles(createRunCache(sandbox.path), repository.files),
            readConfigurations().values(),
        );
        expect(scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
    },
);

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

test('a path argument outside the repository reports an arguments error', () => {
    expect(() => buildArgumentPath('/repo', '/repo/app', '../../outside')).toThrow(
        matchFields<GspotError>({
            code: 'arguments',
            message: 'Path ../../outside is outside this repository.',
        }),
    );
});
