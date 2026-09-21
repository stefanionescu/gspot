import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { readManifests } from '#cli/repository/manifests.ts';

test('Python workspace detection uses captured manifest facts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[project]\ndependencies = ["fastapi>=1"]\n[tool.uv.workspace]\nmembers = ["api"]\n',
        'api/main.py': 'print("ready")\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const facts = readManifests(sandbox.path, repository.files);
    expect(facts[0]!.dependencies).toEqual({ fastapi: 'fastapi>=1' });
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(workspaceScopes(sandbox.path, facts).scopes.map((scope) => scope.path)).toEqual(['api']);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('pyproject.toml');
});

test.each(['package.json', 'pyproject.toml', 'Package.swift'])(
    'a failed read of a discovered %s remains an error',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: path.endsWith('.json') ? '{}' : '' });
        const repository = await readRepository(sandbox.path, [], [], []);
        rmSync(join(sandbox.path, path));
        expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
        mkdirSync(join(sandbox.path, path));
        expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    },
);

test('Python group includes coexist with dependency detection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const facts = readManifests(sandbox.path, repository.files);
    expect(facts[0]!.dependencies).toEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});
