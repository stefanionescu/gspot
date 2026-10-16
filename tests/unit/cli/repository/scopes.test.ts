import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { packageWorkspaces } from '#cli/tools/npm/packages.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/bash/tools.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { NESTED_SCOPES_SETTINGS } from '#tests/config/settings/scopes.ts';
import { PYTHON_WORKSPACE_FILES } from '#tests/config/python/tool-project.ts';
import { joinScope, findScopes, projectFolder } from '#cli/repository/scopes.ts';

import {
    SCOPE_PATHS,
    NOT_PROJECT_FILES,
    PROJECT_FILE_FOLDERS,
    WORKSPACE_DECLARATIONS,
    INVALID_WORKSPACE_FILES,
} from '#tests/config/repository.ts';

test('a command check reads each matching file once across nested scopes', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': NESTED_SCOPES_SETTINGS + BASH_SYNTAX_CHECK,
        'api/entry.sh': 'if then\n',
        'api/worker/entry.sh': 'if then\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = await checkReport(directory.path, ['check', '--only', 'project/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = checked.report.checks;
    expect(
        checks.map((check) => ({ check: check.check, scope: check.scope, fileCount: check.fileCount })),
    ).toStrictEqual([{ check: 'project/bash-syntax', scope: '', fileCount: 2 }]);
    expect(new Set(checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['api/entry.sh', 'api/worker/entry.sh']),
    );
});

test.each(PROJECT_FILE_FOLDERS)('%s with the project file %s marks the folder %j', (path, pattern, folder) => {
    expect(projectFolder(path, pattern)).toBe(folder);
});

test.each(NOT_PROJECT_FILES)('%s is no project file for %s', (path, pattern) => {
    expect(projectFolder(path, pattern)).toBeUndefined();
});

test.each([...WORKSPACE_DECLARATIONS])(
    'workspace files list tooling packages while scope detection keeps applications: %j',
    async (files) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...files,
            'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
            'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
        });
        const repository = await readRepository(createReadCache(sandbox.path), {
            declarations: [],
            scopeEntries: [],
            manifests: configurationManifests(),
        });
        expect(packageWorkspaces(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            'packages/api',
            'packages/lint',
        ]);
        const scopes = findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(sandbox.path), repository.files),
            configurationManifests().values(),
        );
        expect(scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
    },
);

test('workspace detection stays inside the given folder', async () => {
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

test.each([...INVALID_WORKSPACE_FILES])(
    'an invalid or unreadable $path is an error, not an empty workspace',
    async ({ path, parseError }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': '{}', [path]: '{' });
        expect(() => packageWorkspaces(sandbox.path)).toThrow(parseError);
        await Bun.file(join(sandbox.path, path)).delete();
        await mkdir(join(sandbox.path, path));
        expect(() => packageWorkspaces(sandbox.path)).toThrow('EISDIR: illegal operation on a directory, read');
    },
);

test.each([
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
])(
    'workspace detection refuses a package folder outside the repository from %s',
    async (path, declaration, escaped) => {
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
    },
);

test('broad workspace patterns skip .gspot/.venv and its outside interpreter link', async () => {
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
    const repository = await readRepository(createReadCache(root), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    expect(packageWorkspaces(root)).toStrictEqual(['packages/app']);
    expect(
        findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(root), repository.files),
            configurationManifests().values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/app']);
});

test('workspace detection does not parse an unused lower-priority file', async () => {
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
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    const packageManifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const found = findScopes(repository.files, packageManifests, configurationManifests().values());
    expect(found.map((scope) => [scope.path, scope.source])).toStrictEqual([
        ['api', 'project'],
        ['apps/web', 'project'],
        ['ios', 'project'],
        ['services/billing', 'project'],
    ]);
});

test('scope detection leaves out packages that hold only gspot npm tools or a hook manager, and keeps unpinned packages', async () => {
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
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    expect(packageWorkspaces(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'packages/custom',
        'packages/hooks',
        'packages/next',
        'packages/process',
    ]);
    expect(
        findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(sandbox.path), repository.files),
            configurationManifests().values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/process']);
    await writeFile(
        join(sandbox.path, 'packages/next/package.json'),
        '{"dependencies":{"next":"16.0.0"},"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    );
    const corrected = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    expect(
        findScopes(
            corrected.files,
            await readDependencyFiles(createReadCache(sandbox.path), corrected.files),
            configurationManifests().values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/next', 'packages/process']);
});

test('Python scopes use the dependency files read with the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_WORKSPACE_FILES);
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
    });
    const packageManifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(
        findScopes(repository.files, packageManifests, configurationManifests().values()).map((scope) => scope.path),
    ).toStrictEqual(['api']);
});

test.each([...SCOPE_PATHS])(
    '$scope joins $path and gives back its scope-relative path',
    ({ scope, path, repositoryPath }) => {
        expect(joinScope(scope, path)).toBe(repositoryPath);
    },
);
