import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { parseManifest } from '#cli/parsers/configurations.ts';
import { npmToolNames } from '#cli/configurations/declarations.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { rmSync, mkdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { readManifests, readPackageManifest, getProjectDependencies } from '#cli/repository/manifests.ts';

import {
    RUNTIME_EVIDENCE_CASES,
    AUTHORED_PACKAGE_FIELDS,
    PROJECT_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_SCOPES,
} from '#tests/config/cli/repository/manifests.ts';

test('Python project detection uses captured dependencies and actual project files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml':
            '[project]\ndependencies = ["fastapi>=1"]\n[tool.uv.workspace]\nmembers = ["api", "member-only"]\n',
        'api/pyproject.toml': '[project]\nname = "api"\ndependencies = ["fastapi>=1"]\n',
        'api/main.py': 'print("ready")\n',
        'member-only/main.py': 'print("not a project file")\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const projectManifests = readManifests(sandbox.path, repository.files);
    expect(projectManifests.find((entry) => entry.path === 'api/pyproject.toml')?.dependencies).toStrictEqual({
        fastapi: 'fastapi>=1',
    });
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[invalid');
    expect(
        proposedScopes(
            repository.files,
            projectManifests,
            ['pyproject.toml'],
            npmToolNames(configurationManifests().values()),
        ).map((scope) => scope.path),
    ).toStrictEqual(['api']);
    expect(
        detectConfigurations(repository.files, configurationManifests(), projectManifests, 'api').some(
            (entry) => entry.configuration === 'fastapi',
        ),
    ).toBe(true);
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('pyproject.toml');
});

test('a failed read of a discovered manifest remains an error', async () => {
    const path = 'pyproject.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: '' });
    const repository = await readRepository(sandbox.path, [], [], []);
    rmSync(join(sandbox.path, path));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    mkdirSync(join(sandbox.path, path));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(path);
    rmSync(join(sandbox.path, path), { recursive: true });
    writeFileSync(join(sandbox.path, path), '');
    expect(readManifests(sandbox.path, repository.files)).toHaveLength(1);
});

test('package manifest reads preserve authored fields and distinguish missing files from invalid data', async () => {
    await using sandbox = await testdir();
    expect(readPackageManifest(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(AUTHORED_PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageManifest(sandbox.path, 'package.json')).toStrictEqual(AUTHORED_PACKAGE_FIELDS);
    const repository = await readRepository(sandbox.path, [], [], []);
    writeFileSync(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageManifest(sandbox.path, 'package.json')).toThrow(
        'Cannot read package manifest package.json',
    );
    expect(() => readManifests(sandbox.path, repository.files)).toThrow(
        /^Cannot inspect manifest package\.json: (?![\s\S]*Cannot read package manifest)/u,
    );
    writeFileSync(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageManifest(sandbox.path, 'package.json')).toThrow(
        'Cannot read package manifest package.json',
    );
    writeFileSync(join(sandbox.path, 'package.json'), source);
    expect(readPackageManifest(sandbox.path, 'package.json')).toStrictEqual(AUTHORED_PACKAGE_FIELDS);
    expect(readManifests(sandbox.path, repository.files)[0]?.dependencies).toStrictEqual({ next: '16.0.0' });
    expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe(source);
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
    expect(readFileSync(join(sandbox.path, 'pyproject.toml'), 'utf8')).toBe(source);
    expect(readFileSync(join(sandbox.path, 'source.py'), 'utf8')).toBe('print("authored")\n');
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
    rmSync(join(root, path));
    symlinkSync(`../outside/${path}`, join(root, path));
    expect(() => readManifests(root, repository.files)).toThrow('Source link leaves the repository');
    expect(readFileSync(join(directory.path, 'outside', path), 'utf8')).toBe(content);
    rmSync(join(root, path));
    writeFileSync(join(root, path), content);
    expect(readManifests(root, repository.files)).toHaveLength(1);
});

test.each([
    ['pyproject.toml', '[project]\ndependencies = ["FastAPI>=1", "Friendly_Bard>=2"]\n'],
    [
        'pyproject.toml',
        '[tool.poetry.dependencies]\nFaStApI = "^1"\n"Friendly.Bard" = {version = "^2"}\npython = "^3.12"\n',
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
    const projectManifests = readManifests(sandbox.path, repository.files);
    expect(
        Object.keys(projectManifests[0]!.dependencies).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['fastapi', 'friendly-bard']);
    const manifests = configurationManifests();
    const proposed = detectConfigurations(repository.files, manifests, projectManifests, 'api');
    expect(proposed.find((entry) => entry.configuration === 'fastapi')?.evidence).toBe(`fastapi in api/${path}`);
    expect(proposed.find((entry) => entry.configuration === 'python')?.evidence).toBe(`api/${path}`);
    expect(
        detectConfigurations(repository.files, manifests, projectManifests, 'other').some(
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

test('captured manifests follow authored links inside the repository and reject invalid text', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{}',
        'settings/manifest.json': '{"dependencies":{"next":"16.0.0"}}',
        'image.bin': new Uint8Array([0xff, 0xfe]),
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    rmSync(join(sandbox.path, 'package.json'));
    symlinkSync('settings/manifest.json', join(sandbox.path, 'package.json'));
    expect(
        readManifests(sandbox.path, repository.files).map((projectManifest) => projectManifest.dependencies),
    ).toStrictEqual([{ next: '16.0.0' }]);
    writeFileSync(join(sandbox.path, 'settings/manifest.json'), Buffer.from([0xc3, 0x28]));
    expect(() => readManifests(sandbox.path, repository.files)).toThrow('package.json is not UTF-8 text.');
    writeFileSync(join(sandbox.path, 'settings/manifest.json'), '{}');
    expect(
        readManifests(sandbox.path, repository.files).map((projectManifest) => projectManifest.dependencies),
    ).toStrictEqual([{}]);
    expect(readFileSync(join(sandbox.path, 'image.bin'))).toStrictEqual(Buffer.from([0xff, 0xfe]));
});

test.each(RUNTIME_EVIDENCE_CASES)('$name determines runtime applicability within its project', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        'api/.gspot/package.json': JSON.stringify('privatePackage' in entry ? entry.privatePackage : {}),
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const projectManifests = readManifests(sandbox.path, repository.files);
    const manifest = parseManifest(
        `[configuration]\ntitle = "Runtime"\ndescription = "Detects the runtime declared by this project."\n[detect]\nruntimes = ["${entry.runtime}"]\n`,
        'configurations/general/runtime',
    );
    const detected = detectConfigurations(repository.files, new Map([['runtime', manifest]]), projectManifests, 'api');
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
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
