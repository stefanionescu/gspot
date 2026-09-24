import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { mkdirSync, rmSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';

test('Python workspace detection uses captured manifest facts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[project]\ndependencies = ["fastapi>=1"]\n[tool.uv.workspace]\nmembers = ["api"]\n',
        'api/main.py': 'print("ready")\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const facts = readManifests(sandbox.path, repository.files);
    expect(facts[0]!.dependencies).toStrictEqual({ fastapi: 'fastapi>=1' });
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(workspaceScopes(sandbox.path, facts).scopes.map((scope) => scope.path)).toStrictEqual(['api']);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('pyproject.toml');
});

test.each(['package.json', 'pyproject.toml', 'Package.swift', 'Pipfile', 'requirements.txt'])(
    'a failed read of a discovered %s remains an error',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: path.endsWith('.json') ? '{}' : '' });
        const repository = await readRepository(sandbox.path, [], [], []);
        rmSync(join(sandbox.path, path));
        expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
        mkdirSync(join(sandbox.path, path));
        expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
        rmSync(join(sandbox.path, path), { recursive: true });
        writeFileSync(join(sandbox.path, path), path.endsWith('.json') ? '{}' : '');
        expect(readManifests(sandbox.path, repository.files)).toHaveLength(1);
    },
);

test('Python group includes coexist with dependency detection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const facts = readManifests(sandbox.path, repository.files);
    expect(facts[0]!.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test.each(['package.json', 'pyproject.toml', 'Package.swift', 'Pipfile', 'requirements.txt'])(
    'manifest inspection refuses an external link replacing %s and accepts restored bytes',
    async (path) => {
        await using directory = await testdir();
        const content = path === 'package.json' ? '{}' : '';
        await createFileTree(directory.path, {
            [`project/${path}`]: content,
            [`outside/${path}`]: content,
        });
        const root = join(directory.path, 'project');
        const repository = await readRepository(root, [], [], []);
        rmSync(join(root, path));
        symlinkSync(`../outside/${path}`, join(root, path));
        expect(() => readManifests(root, repository.files)).toThrow('private regular file');
        expect(readFileSync(join(directory.path, 'outside', path), 'utf8')).toBe(content);
        rmSync(join(root, path));
        writeFileSync(join(root, path), content);
        expect(readManifests(root, repository.files)).toHaveLength(1);
    },
);

test.each([
    ['pyproject.toml', '[project]\ndependencies = ["FastAPI>=1", "Friendly_Bard>=2"]\n'],
    [
        'pyproject.toml',
        '[tool.poetry.dependencies]\nFaStApI = "^1"\n\"Friendly.Bard\" = {version = "^2"}\npython = "^3.12"\n',
    ],
    [
        'pyproject.toml',
        '[tool.poetry.group.web.dependencies]\nFASTAPI = {version = "^1", extras = ["standard"]}\n"Friendly...__Bard" = "^2"\n',
    ],
    [
        'requirements.txt',
        '# Not a dependency: django\nFastApi[standard]>=1 # web\nFriendly_Bard>=2\n--index-url https://example.com/simple\n-r other.txt\n',
    ],
    ['requirements-dev.txt', 'FaStApI @ https://example.com/fastapi.whl\nFriendly.Bard==2\n'],
    ['Pipfile', '[packages]\nfastAPI = {version = "*", extras = ["standard"]}\n"Friendly--Bard" = "==2"\n'],
] as const)('Python dependency detection reads %s without changing source', async (path, source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`api/${path}`]: source, 'other/readme.txt': 'No Python dependencies.\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const facts = readManifests(sandbox.path, repository.files);
    expect(Object.keys(facts[0]!.dependencies).sort()).toStrictEqual(['fastapi', 'friendly-bard']);
    const manifests = configurationManifests();
    const proposed = detectConfigurations(repository.files, manifests, facts, 'api');
    expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
    expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(repository.files, manifests, facts, 'other').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(false);
    expect(readFileSync(join(sandbox.path, 'api', path), 'utf8')).toBe(source);
    writeFileSync(join(sandbox.path, 'api', path), path.endsWith('.txt') ? '# dependencies removed\n' : '');
    const corrected = readManifests(sandbox.path, repository.files);
    expect(
        detectConfigurations(repository.files, manifests, corrected, 'api').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(false);
});

test.each([
    ['pyproject.toml', '[tool.poetry.dependencies]\nFastAPI = 7\n'],
    ['pyproject.toml', '[tool.poetry.group.web.dependencies]\nFastAPI = false\n'],
    ['Pipfile', '[packages]\nFastAPI = 7\n'],
] as const)('invalid Python dependency data in %s reports its source and preserves it', async (path, source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(`Cannot inspect manifest ${path}`);
    expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(source);
    writeFileSync(join(sandbox.path, path), source.replace(/7|false/u, '"*"'));
    expect(readManifests(sandbox.path, repository.files)[0]!.dependencies).toStrictEqual({ fastapi: '*' });
});
