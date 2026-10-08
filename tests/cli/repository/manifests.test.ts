import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { PYTHON_PROJECT_FILES } from '#tests/config/samples/python.ts';
import { readManifests, readPackageManifest, getProjectDependencies } from '#cli/repository/manifests.ts';

import {
    INVALID_MANIFESTS,
    AUTHORED_PACKAGE_FIELDS,
    PROJECT_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_SCOPES,
    INVALID_PYTHON_DEPENDENCY_CASES,
} from '#tests/config/cli/repository/manifests.ts';

test('Python manifest reads preserve captured dependencies and report invalid current text', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PYTHON_PROJECT_FILES);
    const repository = await readRepository(sandbox.path, [], [], []);
    const projectManifests = readManifests(sandbox.path, repository.files);
    expect(projectManifests.find((entry) => entry.path === 'api/pyproject.toml')?.dependencies).toStrictEqual({
        fastapi: 'fastapi>=1',
    });
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('pyproject.toml');
});

test('a failed read of a discovered manifest remains an error', async () => {
    const path = 'pyproject.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: '' });
    const repository = await readRepository(sandbox.path, [], [], []);
    await rm(join(sandbox.path, path));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    await mkdir(join(sandbox.path, path));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    await rm(join(sandbox.path, path), { recursive: true });
    await writeFile(join(sandbox.path, path), '');
    expect(readManifests(sandbox.path, repository.files)).toHaveLength(1);
});

test('package manifest reads preserve authored fields and distinguish missing files from invalid data', async () => {
    await using sandbox = await testdir();
    expect(readPackageManifest(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(AUTHORED_PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageManifest(sandbox.path, 'package.json')).toStrictEqual(AUTHORED_PACKAGE_FIELDS);
    const repository = await readRepository(sandbox.path, [], [], []);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageManifest(sandbox.path, 'package.json')).toThrow(
        'Cannot read package manifest package.json',
    );
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(
        /^Cannot inspect manifest package\.json: (?![\s\S]*Cannot read package manifest)/u,
    );
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageManifest(sandbox.path, 'package.json')).toThrow(
        'Cannot read package manifest package.json',
    );
    await writeFile(join(sandbox.path, 'package.json'), source);
    expect(readPackageManifest(sandbox.path, 'package.json')).toStrictEqual(AUTHORED_PACKAGE_FIELDS);
    expect(readManifests(sandbox.path, repository.files)[0]?.dependencies).toStrictEqual({ next: '16.0.0' });
});

test('Python group includes coexist with dependency detection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const projectManifests = readManifests(sandbox.path, repository.files);
    expect(projectManifests[0]!.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test('pytest configuration records tool use without requiring an authored dependency', async () => {
    await using sandbox = await testdir();
    const source = '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';
    await createFileTree(sandbox.path, { 'pyproject.toml': source, 'source.py': 'print("authored")\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const manifests = readManifests(sandbox.path, repository.files);
    expect(manifests[0]?.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test('manifest inspection refuses an external link replacing a manifest and accepts restored bytes', async () => {
    const path = 'package.json';
    await using directory = await testdir();
    const content = '{}';
    await createFileTree(directory.path, {
        [`project/${path}`]: content,
        [`outside/${path}`]: content,
    });
    const root = join(directory.path, 'project');
    const repository = await readRepository(root, [], [], []);
    await rm(join(root, path));
    await symlink(`../outside/${path}`, join(root, path));
    expect(() => readManifests(root, repository.files)).toThrow('Source link leaves the repository');
    await rm(join(root, path));
    await writeFile(join(root, path), content);
    expect(readManifests(root, repository.files)).toHaveLength(1);
});

test.each(INVALID_PYTHON_DEPENDENCY_CASES)('invalid $name in $path reports its source', async ({ path, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(`Cannot inspect manifest ${path}`);
    await writeFile(join(sandbox.path, path), source.replace(/7|false/u, '"*"'));
    expect(readManifests(sandbox.path, repository.files)[0]!.dependencies).toStrictEqual({ fastapi: '*' });
});

test('captured manifests follow authored links inside the repository and reject invalid text', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{}',
        'settings/manifest.json': '{"dependencies":{"next":"16.0.0"}}',
        'image.bin': new Uint8Array([0xff, 0xfe]),
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    await rm(join(sandbox.path, 'package.json'));
    await symlink('settings/manifest.json', join(sandbox.path, 'package.json'));
    expect(
        readManifests(sandbox.path, repository.files).map((projectManifest) => projectManifest.dependencies),
    ).toStrictEqual([{ next: '16.0.0' }]);
    await writeFile(join(sandbox.path, 'settings/manifest.json'), Buffer.from([0xc3, 0x28]));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('package.json is not UTF-8 text.');
    await writeFile(join(sandbox.path, 'settings/manifest.json'), '{}');
    expect(
        readManifests(sandbox.path, repository.files).map((projectManifest) => projectManifest.dependencies),
    ).toStrictEqual([{}]);
});

test('declared framework dependencies follow the nearest npm project boundary', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, PROJECT_DEPENDENCY_FILES);
    const repository = await readRepository(sandbox.path, [], [], []);
    const manifests = readManifests(sandbox.path, repository.files);
    for (const { scope, dependencies } of PROJECT_DEPENDENCY_SCOPES) {
        expect(getProjectDependencies(manifests, scope), scope).toStrictEqual(dependencies);
    }
});

test.each(INVALID_MANIFESTS)('invalid %s content %s remains a manifest-reader error', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
});
