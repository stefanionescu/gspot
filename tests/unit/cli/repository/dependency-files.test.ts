import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildTrackedFile, readTestRepository } from '#tests/setup/builders.ts';
import { PYTHON_WORKSPACE_FILES } from '#tests/data/tools/python-tool-project.ts';
import { readPackageJson, readDependencyFiles, getProjectDependencies } from '#cli/repository/dependency-files.ts';

import {
    PACKAGE_FIELDS,
    REACT_VUE_PACKAGES,
    INVALID_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_SCOPES,
    INVALID_PYTHON_DEPENDENCIES,
    ROOT_PACKAGE_WITHOUT_DEPENDENCIES,
} from '#tests/data/repository/dependency-files.ts';

test('Python dependency groups with includes keep every dependency', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });
    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(dependencyFiles[0]!.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test('a pytest table counts as a pytest dependency', async () => {
    await using sandbox = await testdir();
    const source = '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';
    await createFileTree(sandbox.path, { 'pyproject.toml': source, 'source.py': 'print("authored")\n' });
    const repository = await readTestRepository(sandbox.path);
    const manifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(manifests[0]?.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test.each([...INVALID_PYTHON_DEPENDENCIES])('an invalid $name in $path names the file', async ({ path, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    const files = [buildTrackedFile(path)];
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), files))).toContain(
        `Cannot read the dependency file ${path}`,
    );
});

test.each(INVALID_DEPENDENCY_FILES)('invalid %s content %s is a dependency file error', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const files = [buildTrackedFile(path)];
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), files))).toContain(path);
});

test('Python dependency file reads keep their dependencies and report invalid text', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_WORKSPACE_FILES);
    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(dependencyFiles.find((entry) => entry.path === 'api/pyproject.toml')?.dependencies).toStrictEqual({
        fastapi: 'fastapi>=1',
    });
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files))).toContain(
        'pyproject.toml',
    );
});

test('a dependency file that disappears after the repository read is an error', async () => {
    const path = 'pyproject.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: '' });
    const repository = await readTestRepository(sandbox.path);
    await rm(join(sandbox.path, path));
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files))).toContain(
        path,
    );
    await mkdir(join(sandbox.path, path));
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files))).toContain(
        path,
    );
});

test('package.json reads keep your own fields and tell a missing file from invalid data', async () => {
    await using sandbox = await testdir();
    expect(readPackageJson(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageJson(sandbox.path, 'package.json')).toStrictEqual(PACKAGE_FIELDS);
    const repository = await readTestRepository(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow('package.json is not valid JSON.');
    expect(await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files))).toMatch(
        /^Cannot read the dependency file package\.json: (?![\s\S]*Cannot read the dependency file)/u,
    );
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow('package.json is not valid JSON.');
});

test('declared framework dependencies follow the nearest npm project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PROJECT_DEPENDENCY_FILES);
    const repository = await readTestRepository(sandbox.path);
    const manifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    for (const { scope, dependencies } of PROJECT_DEPENDENCY_SCOPES) {
        expect(getProjectDependencies(manifests, scope), scope).toStrictEqual(dependencies);
    }
});

test('a broken package.json stops the next session and a fixed one changes the scope dependencies', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...REACT_VUE_PACKAGES,
        'gspot.toml': buildSettingsText(['javascript'], {
            rules: true,
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
        }),
    });
    await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(await captureRejection(openSession(sandbox.path))).toContain('package.json is not valid JSON.');
    await writeFile(join(sandbox.path, 'package.json'), ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    const current = await openSession(sandbox.path);
    expect(
        current.scopes.map((selection) =>
            Object.keys(getProjectDependencies(current.repository.dependencyFiles, selection.scope.path)),
        ),
    ).toStrictEqual([[], ['vue']]);
});
