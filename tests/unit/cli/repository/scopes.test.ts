import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { readTestRepository } from '#tests/setup/builders.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { listWorkspaceFolders } from '#cli/repository/packages.ts';
import { LAYERED_SCOPE_SETTINGS } from '#tests/data/settings/scopes.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { PYTHON_WORKSPACE_FILES } from '#tests/data/install/python-tool-project.ts';
import { joinScope, findScopes, findProjectFolder } from '#cli/repository/scopes.ts';

import {
    SCOPE_PATHS,
    PROJECT_FILE_FOLDERS,
    WORKSPACE_DECLARATIONS,
    INVALID_WORKSPACE_FILES,
} from '#tests/data/repository/scopes.ts';

test('a command check reads each matching file once across nested scopes', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': LAYERED_SCOPE_SETTINGS + BASH_SYNTAX_CHECK,
        'api/entry.sh': 'if then\n',
        'api/worker/entry.sh': 'if then\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });
    const applied = await runGspot(folder.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = await checkReport(folder.path, ['check', '--only', 'project/bash-syntax', '--json']);
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
    expect(findProjectFolder(path, pattern)).toBe(folder);
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
        const repository = await readTestRepository(sandbox.path);
        expect(listWorkspaceFolders(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            'packages/api',
            'packages/lint',
        ]);
        const scopes = findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(sandbox.path), repository.files),
            readManifests(createReadCache(process.cwd())).values(),
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
    for (const folder of ['child', 'empty']) {
        const root = join(sandbox.path, folder);
        expect(listWorkspaceFolders(root)).toStrictEqual([]);
    }
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    expect(listWorkspaceFolders(join(sandbox.path, 'empty'))).toStrictEqual([]);
});

test.each([...INVALID_WORKSPACE_FILES])(
    'an invalid or unreadable $path is a GspotError that names the file',
    async ({ path, parseError }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': '{}', [path]: '{' });
        expect(() => listWorkspaceFolders(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: parseError,
                cause: expect.any(Error),
            }),
        );
        await Bun.file(join(sandbox.path, path)).delete();
        await mkdir(join(sandbox.path, path));
        expect(() => listWorkspaceFolders(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path} is not a valid workspace file: EISDIR: illegal operation on a directory, read. Fix the file.`,
                cause: expect.any(Error),
            }),
        );
    },
);

test.each([
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
])(
    'workspace detection refuses a package folder outside the repository from %s',
    async (path, declaration, escaped) => {
        await using folder = await testdir();
        await createFileTree(folder.path, {
            'project/package.json': '{}',
            [`project/${path}`]: declaration,
            'project/packages/.keep': '',
            'outside/package.json': '{"name":"outside"}',
            'outside/app/package.json': '{"name":"outside-app"}',
        });
        const root = join(folder.path, 'project');
        await symlink('../../outside', join(root, 'packages/linked'), 'dir');
        expect(() => listWorkspaceFolders(root)).toThrow(`Workspace package leaves the repository: ${join(escaped)}`);
        expect(listWorkspaceFolders(join(root, 'packages'))).toStrictEqual([]);
    },
);

test('broad workspace patterns skip .gspot/.venv and its outside interpreter link', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'project/package.json': '{"workspaces":["**"]}',
        'project/packages/app/package.json': '{"name":"application"}',
        'project/.gspot/package.json': '{"name":"private-tools"}',
        'project/.gspot/.venv/bin/.keep': '',
        'outside/python': 'The interpreter belongs outside the repository.\n',
    });
    const root = join(folder.path, 'project');
    await symlink('../../../../outside/python', join(root, '.gspot/.venv/bin/python'));
    const repository = await readTestRepository(root);
    expect(listWorkspaceFolders(root)).toStrictEqual(['packages/app']);
    expect(
        findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(root), repository.files),
            readManifests(createReadCache(process.cwd())).values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/app']);
});

test('workspace detection does not parse an unused lower-priority file', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'package.json': '{}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
        'lerna.json': 'malformed inactive configuration',
        'packages/app/package.json': '{"name":"inside"}',
    });
    expect(listWorkspaceFolders(folder.path)).toStrictEqual(['packages/app']);
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
    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const found = findScopes(repository.files, dependencyFiles, readManifests(createReadCache(process.cwd())).values());
    expect(found.map((scope) => [scope.path, scope.origin])).toStrictEqual([
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
    const repository = await readTestRepository(sandbox.path);
    expect(listWorkspaceFolders(sandbox.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'packages/custom',
        'packages/hooks',
        'packages/next',
        'packages/process',
    ]);
    expect(
        findScopes(
            repository.files,
            await readDependencyFiles(createReadCache(sandbox.path), repository.files),
            readManifests(createReadCache(process.cwd())).values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/process']);
    await writeFile(
        join(sandbox.path, 'packages/next/package.json'),
        '{"dependencies":{"next":"16.0.0"},"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    );
    const corrected = await readTestRepository(sandbox.path);
    expect(
        findScopes(
            corrected.files,
            await readDependencyFiles(createReadCache(sandbox.path), corrected.files),
            readManifests(createReadCache(process.cwd())).values(),
        ).map((scope) => scope.path),
    ).toStrictEqual(['packages/custom', 'packages/next', 'packages/process']);
});

test('Python scopes use the dependency files read with the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_WORKSPACE_FILES);
    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(
        findScopes(repository.files, dependencyFiles, readManifests(createReadCache(process.cwd())).values()).map(
            (scope) => scope.path,
        ),
    ).toStrictEqual(['api']);
});

test.each([...SCOPE_PATHS])(
    '$scope joins $path and gives back its scope-relative path',
    ({ scope, path, repositoryPath }) => {
        expect(joinScope(scope, path)).toBe(repositoryPath);
    },
);
