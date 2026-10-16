import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildTrackedFile } from '#tests/setup/tracked-file.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { INVALID_DEPENDENCY_FILES, INVALID_PYTHON_DEPENDENCIES } from '#tests/config/repository.ts';

test('Python dependency groups with includes keep every dependency', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const packageManifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(packageManifests[0]!.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test('a pytest table counts as a pytest dependency', async () => {
    await using sandbox = await testdir();
    const source = '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';
    await createFileTree(sandbox.path, { 'pyproject.toml': source, 'source.py': 'print("authored")\n' });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopeEntries: [],
        manifests: readManifests(),
    });
    const manifests = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(manifests[0]?.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test.each([...INVALID_PYTHON_DEPENDENCIES])('an invalid $name in $path names the file', async ({ path, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    const files = [buildTrackedFile(path)];
    expect(readDependencyFiles(createReadCache(sandbox.path), files)).rejects.toThrow(
        `Cannot inspect manifest ${path}`,
    );
});

test.each(INVALID_DEPENDENCY_FILES)('invalid %s content %s is a dependency file error', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const files = [buildTrackedFile(path)];
    expect(readDependencyFiles(createReadCache(sandbox.path), files)).rejects.toThrow(path);
});
