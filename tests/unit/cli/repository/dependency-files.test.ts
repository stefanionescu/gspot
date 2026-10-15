import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/file-reads.ts';
import { projectDependencies } from '#cli/repository/scopes.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { PYTHON_WORKSPACE_FILES } from '#tests/config/python/tool-project.ts';
import { readPackageJson, readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { REACT_VUE_PACKAGES, ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/config/npm.ts';
import { PACKAGE_FIELDS, PROJECT_DEPENDENCY_FILES, PROJECT_DEPENDENCY_SCOPES } from '#tests/config/repository.ts';

test('Python dependency file reads keep their dependencies and report invalid text', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_WORKSPACE_FILES);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const packageManifests = await readDependencyFiles(sandbox.path, repository.files);
    expect(packageManifests.find((entry) => entry.path === 'api/pyproject.toml')?.dependencies).toStrictEqual({
        fastapi: 'fastapi>=1',
    });
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(readDependencyFiles(sandbox.path, repository.files)).rejects.toThrow('pyproject.toml');
});

test('a dependency file that disappears after the repository read is an error', async () => {
    const path = 'pyproject.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: '' });
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    await rm(join(sandbox.path, path));
    expect(readDependencyFiles(sandbox.path, repository.files)).rejects.toThrow(path);
    await mkdir(join(sandbox.path, path));
    expect(readDependencyFiles(sandbox.path, repository.files)).rejects.toThrow(path);
});

test('package.json reads keep your own fields and tell a missing file from invalid data', async () => {
    await using sandbox = await testdir();
    expect(readPackageJson(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageJson(sandbox.path, 'package.json')).toStrictEqual(PACKAGE_FIELDS);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow('package.json is not valid JSON.');
    expect(readDependencyFiles(sandbox.path, repository.files)).rejects.toThrow(
        /^Cannot inspect manifest package\.json: (?![\s\S]*Cannot read package manifest)/u,
    );
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow('package.json is not valid JSON.');
});

test('declared framework dependencies follow the nearest npm project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PROJECT_DEPENDENCY_FILES);
    const repository = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    const manifests = await readDependencyFiles(sandbox.path, repository.files);
    for (const { scope, dependencies } of PROJECT_DEPENDENCY_SCOPES) {
        expect(projectDependencies(manifests, scope), scope).toStrictEqual(dependencies);
    }
});

test('a broken package.json stops the next session and a fixed one changes the scope dependencies', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...REACT_VUE_PACKAGES,
        'gspot.toml': settingsText(['javascript'], {
            rules: true,
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
        }),
    });
    await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(await rejection(openSession(sandbox.path))).toContain('package.json is not valid JSON.');
    await writeFile(join(sandbox.path, 'package.json'), ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    const current = await openSession(sandbox.path);
    expect(
        current.scopes.map((selection) =>
            Object.keys(projectDependencies(current.packageManifests, selection.scope.path)),
        ),
    ).toStrictEqual([[], ['vue']]);
});
