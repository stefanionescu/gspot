import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { symlink, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { PROJECT_FILE_FOLDERS } from '#tests/config/repository.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readDependencyFiles } from '#cli/repository/projects/dependencies.ts';
import { findProjectFolder, detectScopeFolders } from '#cli/repository/detection/scopes.ts';

test.each(PROJECT_FILE_FOLDERS)('%s with the project file %s marks the folder %j', (path, pattern, folder) => {
    expect(findProjectFolder(path, pattern)).toBe(folder);
});

test('scope detection skips .gspot/.venv and its outside interpreter link', async () => {
    await using sandbox = await createGitSandbox({
        'project/package.json': '{"workspaces":["**"]}',
        'project/packages/app/package.json': '{"name":"application"}',
        'project/.gspot/package.json': '{"name":"private-tools"}',
        'project/.gspot/.venv/bin/.keep': '',
        'outside/python': 'The interpreter belongs outside the repository.\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await symlink('../../../../outside/python', join(root, `${GSPOT_PATHS.pythonEnvironment}/bin/python`));
    const repository = await readTestRepository(root);
    const folders = detectScopeFolders(
        repository.files,
        await readDependencyFiles(createRunCache(root), repository.files),
        readConfigurations().values(),
    ).map((scope) => scope.path);
    expect(folders).toStrictEqual(['packages/app']);
});

test('every folder that holds a project file is a scope, the root and lint-only packages aside', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}',
        'supabase/config.toml': 'project_id = "example"\n',
        'api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'api/src/index.js': 'export {};\n',
        'ios/App.xcodeproj/project.pbxproj': '// !$*UTF8*$!\n',
        'ios/Sources/App.swift': 'import Foundation\n',
        'mobile/Package.swift': '// swift-tools-version:6.0\n',
        'services/billing/pyproject.toml': '[project]\nname = "billing"\n',
        'tools/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
        'apps/web/supabase/config.toml': 'project_id = "web"\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    const found = detectScopeFolders(repository.files, dependencyFiles, readConfigurations().values());
    expect(found.map((scope) => [scope.path, scope.origin])).toStrictEqual([
        ['api', 'project'],
        ['apps/web', 'project'],
        ['ios', 'project'],
        ['mobile', 'project'],
        ['services/billing', 'project'],
    ]);
});

test('scope detection leaves out packages that hold only gspot npm tools or a hook manager, and keeps unpinned packages', async () => {
    await using sandbox = await createGitSandbox({
        'packages/process/package.json': '{"devDependencies":{"concurrently":"9.0.0"}}',
        'packages/custom/package.json': '{"devDependencies":{"eslint-plugin-custom":"1.0.0"}}',
        'packages/next/package.json': '{"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
        'packages/hooks/package.json': '{"devDependencies":{"husky":"9.0.0"}}',
    });
    const repository = await readTestRepository(sandbox.path);
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
