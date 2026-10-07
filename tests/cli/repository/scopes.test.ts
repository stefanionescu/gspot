import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { npmToolNames } from '#cli/configurations/pins.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { scopeOf, proposedScopes, packageWorkspaces } from '#cli/repository/scopes.ts';
import { rmSync, mkdirSync, unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

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
    const scopes = proposedScopes(
        repository.files,
        readManifests(sandbox.path, repository.files),
        ['package.json'],
        npmToolNames(configurationManifests().values()),
    );
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
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    expect(packageWorkspaces(join(sandbox.path, 'empty'))).toStrictEqual([]);
});

test.each(['pnpm-workspace.yaml', 'lerna.json', 'rush.json'])(
    'invalid or unreadable %s cannot become an empty workspace',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': '{}', [path]: '{' });
        expect(() => packageWorkspaces(sandbox.path)).toThrow();
        await Bun.file(join(sandbox.path, path)).delete();
        mkdirSync(join(sandbox.path, path));
        expect(() => packageWorkspaces(sandbox.path)).toThrow();
        rmSync(join(sandbox.path, path), { recursive: true });
        await createFileTree(sandbox.path, {
            [path]:
                path === 'rush.json'
                    ? '{"projects":[{"packageName":"app","projectFolder":"packages/app"}]}'
                    : '{"packages":["packages/*"]}',
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
    symlinkSync('../../outside', join(root, 'packages/linked'));
    expect(() => packageWorkspaces(root)).toThrow(`Workspace package leaves the repository: ${escaped}`);
    expect(readFileSync(join(directory.path, 'outside/package.json'), 'utf8')).toBe('{"name":"outside"}');
    expect(packageWorkspaces(join(root, 'packages'))).toStrictEqual([]);
    unlinkSync(join(root, 'packages/linked'));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
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
    symlinkSync('../../../../outside/python', join(root, '.gspot/.venv/bin/python'));
    const repository = await readRepository(root, [], [], []);
    expect(packageWorkspaces(root)).toStrictEqual(['packages/app']);
    expect(
        proposedScopes(
            repository.files,
            readManifests(root, repository.files),
            ['package.json'],
            npmToolNames(configurationManifests().values()),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/app']);
    expect(readFileSync(join(directory.path, 'outside/python'), 'utf8')).toBe(
        'The interpreter belongs outside the repository.\n',
    );
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
    const projectManifests = readManifests(sandbox.path, repository.files);
    const found = proposedScopes(
        repository.files,
        projectManifests,
        [...configurationManifests().values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(configurationManifests().values()),
    );
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
    symlinkSync('settings/root.json', join(sandbox.path, 'package.json'));
    symlinkSync('settings/workspace.yaml', join(sandbox.path, 'pnpm-workspace.yaml'));
    symlinkSync('../../settings/app.json', join(sandbox.path, 'packages/app/package.json'));
    expect(packageWorkspaces(sandbox.path)).toStrictEqual(['packages/app']);
    expect(readFileSync(join(sandbox.path, 'settings/workspace.yaml'), 'utf8')).toBe('packages: ["packages/*"]\n');
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
        proposedScopes(
            repository.files,
            readManifests(sandbox.path, repository.files),
            ['package.json'],
            npmToolNames(configurationManifests().values()),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/process']);
    for (const [path, bytes] of Object.entries(manifests))
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(bytes);
    writeFileSync(
        join(sandbox.path, 'packages/next/package.json'),
        '{"dependencies":{"next":"16.0.0"},"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    );
    const corrected = await readRepository(sandbox.path, [], [], []);
    expect(
        proposedScopes(
            corrected.files,
            readManifests(sandbox.path, corrected.files),
            ['package.json'],
            npmToolNames(configurationManifests().values()),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/next', 'packages/process']);
});
