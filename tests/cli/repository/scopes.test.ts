import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/public.ts';
import { npmToolNames } from '#cli/configurations/contracts.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { PYTHON_PROJECT_FILES } from '#tests/config/samples/python.ts';
import { rm, mkdir, unlink, symlink, writeFile } from 'node:fs/promises';
import { INVALID_WORKSPACE_CASES } from '#tests/config/cli/repository/scopes.ts';
import { scopeOf, plannedScopes, packageWorkspaces } from '#cli/repository/paths/contracts.ts';

function proposeProjectScopes(files: TrackedFile[], manifests: PackageManifest[]) {
    const configurations = configurationManifests();
    return plannedScopes(
        files,
        manifests,
        [...configurations.values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(configurations.values()),
    );
}

test.each([
    { 'package.json': '{"workspaces":["packages/*"]}' },
    { 'package.json': '{"workspaces":{"packages":["packages/*"]}}' },
    { 'package.json': '{}', 'pnpm-workspace.yaml': 'packages: ["packages/*"]' },
    { 'package.json': '{}', 'lerna.json': '{"packages":["packages/*"]}' },
    {
        'rush.json':
            '{"projects":[{"packageName":"api","projectFolder":"packages/api"},{"packageName":"lint","projectFolder":"packages/lint"}]}',
    },
])('workspace declarations retain tooling packages while scope discovery selects applications: %j', async (files) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...files,
        'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(packageWorkspaces(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'packages/api',
        'packages/lint',
    ]);
    const scopes = proposeProjectScopes(repository.files, readPackageManifests(sandbox.path, repository.files));
    expect(scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
});

test('workspace discovery stays within the requested root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]',
        'packages/parent/package.json': '{"name":"parent"}',
        'child/package.json': '{}',
        'empty/source.py': '',
    });
    for (const directory of ['child', 'empty']) {
        const root = join(sandbox.path, directory);
        expect(packageWorkspaces(root)).toStrictEqual([]);
    }
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    expect(packageWorkspaces(join(sandbox.path, 'empty'))).toStrictEqual([]);
});

test.each(INVALID_WORKSPACE_CASES)(
    'invalid or unreadable $path cannot become an empty workspace',
    async ({ path, content, parseError }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': '{}', [path]: '{' });
        expect(() => packageWorkspaces(sandbox.path)).toThrow(parseError);
        await Bun.file(join(sandbox.path, path)).delete();
        await mkdir(join(sandbox.path, path));
        expect(() => packageWorkspaces(sandbox.path)).toThrow('EISDIR: illegal operation on a directory, read');
        await rm(join(sandbox.path, path), { recursive: true });
        await createFileTree(sandbox.path, {
            [path]: content,
            'packages/app/package.json': '{"name":"app"}',
        });
        expect(packageWorkspaces(sandbox.path)).toStrictEqual(['packages/app']);
    },
);

test.each([
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
])('workspace discovery refuses an external package folder from %s', async (path, declaration, escaped) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/package.json': '{}',
        [`project/${path}`]: declaration,
        'project/packages/.keep': '',
        'outside/package.json': '{"name":"outside"}',
        'outside/app/package.json': '{"name":"outside-app"}',
    });
    const root = join(directory.path, 'project');
    await symlink('../../outside', join(root, 'packages/linked'), 'dir');
    expect(() => packageWorkspaces(root)).toThrow(`Workspace package leaves the repository: ${join(escaped)}`);
    expect(packageWorkspaces(join(root, 'packages'))).toStrictEqual([]);
    await unlink(join(root, 'packages/linked'));
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
    await createFileTree(root, { 'packages/app/package.json': '{"name":"inside"}' });
    expect(packageWorkspaces(root)).toStrictEqual(['packages/app']);
});

test('broad workspace patterns ignore private environments containing external interpreter links', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/package.json': '{"workspaces":["**"]}',
        'project/packages/app/package.json': '{"name":"application"}',
        'project/.gspot/package.json': '{"name":"private-tools"}',
        'project/.gspot/.venv/bin/.keep': '',
        'outside/python': 'The interpreter belongs outside the repository.\n',
    });
    const root = join(directory.path, 'project');
    await symlink('../../../../outside/python', join(root, '.gspot/.venv/bin/python'));
    const repository = await readRepository(root, [], [], []);
    expect(packageWorkspaces(root)).toStrictEqual(['packages/app']);
    expect(
        proposeProjectScopes(repository.files, readPackageManifests(root, repository.files)).map((scope) => scope.path),
    ).toStrictEqual(['packages/app']);
});

test('workspace selection does not parse an inactive lower-priority configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
        'lerna.json': 'malformed inactive configuration',
        'packages/app/package.json': '{"name":"inside"}',
    });
    expect(packageWorkspaces(directory.path)).toStrictEqual(['packages/app']);
});

test('every folder that holds a project file is a scope, the root and lint-only packages aside', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}',
        'supabase/config.toml': 'project_id = "example"\n',
        'api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'api/src/index.js': 'export {};\n',
        'ios/App.xcodeproj/project.pbxproj': '// !$*UTF8*$!\n',
        'ios/Sources/App.swift': 'import Foundation\n',
        'services/billing/pyproject.toml': '[project]\nname = "billing"\n',
        'tools/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
        'apps/web/supabase/config.toml': 'project_id = "web"\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const packageManifests = readPackageManifests(sandbox.path, repository.files);
    const found = proposeProjectScopes(repository.files, packageManifests);
    expect(found.map((scope) => [scope.path, scope.source])).toStrictEqual([
        ['api', 'project'],
        ['apps/web', 'project'],
        ['ios', 'project'],
        ['services/billing', 'project'],
    ]);
});

test('workspace discovery accepts linked authored declarations and package manifests inside the root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'settings/root.json': '{}',
        'settings/workspace.yaml': 'packages: ["packages/*"]\n',
        'settings/app.json': '{"name":"application"}',
        'packages/app/.keep': '',
    });
    await symlink('settings/root.json', join(sandbox.path, 'package.json'));
    await symlink('settings/workspace.yaml', join(sandbox.path, 'pnpm-workspace.yaml'));
    await symlink('../../settings/app.json', join(sandbox.path, 'packages/app/package.json'));
    expect(packageWorkspaces(sandbox.path)).toStrictEqual(['packages/app']);
});

test('root selections remain local to each repository read and missing-scope fallback', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.py': 'answer = 1\n' });
    const first = await readRepository(sandbox.path, [], [], []);
    const second = await readRepository(sandbox.path, [], [], []);
    first.scopes[0]!.configurations.push('python');
    expect(second.scopes[0]).toStrictEqual({ name: 'root', path: '', configurations: [], source: 'root' });
    const root = scopeOf('source.py', []);
    root.configurations.push('swift');
    expect(scopeOf('source.py', [])).toStrictEqual({ name: 'root', path: '', configurations: [], source: 'root' });
    expect(first.scopes[0]!.configurations).toStrictEqual(['python']);
});

test('scope discovery excludes declared npm tools and hook managers without hiding unpinned packages', async () => {
    await using sandbox = await testdir();
    const manifests = {
        'packages/process/package.json': '{"devDependencies":{"concurrently":"9.0.0"}}',
        'packages/custom/package.json': '{"devDependencies":{"eslint-plugin-custom":"1.0.0"}}',
        'packages/next/package.json': '{"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
        'packages/hooks/package.json': '{"devDependencies":{"husky":"9.0.0"}}',
    };
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        ...manifests,
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(packageWorkspaces(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'packages/custom',
        'packages/hooks',
        'packages/next',
        'packages/process',
    ]);
    expect(
        proposeProjectScopes(repository.files, readPackageManifests(sandbox.path, repository.files)).map(
            (scope) => scope.path,
        ),
    ).toStrictEqual(['packages/custom', 'packages/process']);
    await writeFile(
        join(sandbox.path, 'packages/next/package.json'),
        '{"dependencies":{"next":"16.0.0"},"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    );
    const corrected = await readRepository(sandbox.path, [], [], []);
    expect(
        proposeProjectScopes(corrected.files, readPackageManifests(sandbox.path, corrected.files)).map(
            (scope) => scope.path,
        ),
    ).toStrictEqual(['packages/custom', 'packages/next', 'packages/process']);
});

test('Python scopes use captured project files and omit workspace-only members after the manifest changes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_PROJECT_FILES);
    const repository = await readRepository(sandbox.path, [], [], []);
    const packageManifests = readPackageManifests(sandbox.path, repository.files);
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(proposeProjectScopes(repository.files, packageManifests).map((scope) => scope.path)).toStrictEqual(['api']);
});
