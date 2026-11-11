import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { SOURCE_KIND } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { listProjectDependencyNames, readDependencyFiles, readPackageJson } from '#cli/repository/dependencies.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/config/repository/detect.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

const PROJECT_DEPENDENCY_FILES = {
    'package.json': '{"dependencies":{"@nestjs/swagger":"11.2.3"}}',
    'app/package.json': '{"devDependencies":{"tailwindcss":"4.1.13"}}',
    'other/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'empty/package.json': '{"private":true}',
} as const;

const PROJECT_DEPENDENCY_SCOPES = [
    { scope: '', names: ['@nestjs/swagger'] },
    { scope: 'application', names: ['@nestjs/swagger'] },
    { scope: 'app', names: ['tailwindcss'] },
    { scope: 'app/styles', names: ['tailwindcss'] },
    { scope: 'empty', names: [] },
] as const;

const INVALID_DEPENDENCY_FILES = [
    ['package.json', '{"dependencies":{"typescript":7}}'],
    ['pyproject.toml', '[project'],
] as const;

const REACT_VUE_PACKAGES = {
    'package.json': '{"name":"root-sandbox","private":true,"dependencies":{"react":"19.0.0"}}',
    'app/package.json': '{"name":"child-sandbox","private":true,"dependencies":{"vue":"3.5.0"}}',
    'main.js': 'export const ready = true;\n',
    'app/main.js': 'export const ready = true;\n',
} as const;

const ROOT_PACKAGE_WITHOUT_DEPENDENCIES = '{"name":"root-sandbox","private":true,"dependencies":{}}';

test('Python dependency groups with includes keep every dependency', async () => {
    await using sandbox = await createGitSandbox({
        'pyproject.toml': '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n',
    });

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    expect(dependencyFiles[0]!.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test('a pytest table counts as a pytest dependency', async () => {
    await using sandbox = await createGitSandbox({});
    const source = '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';
    await createFileTree(sandbox.path, { 'pyproject.toml': source, 'source.py': 'print("authored")\n' });
    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    expect(dependencyFiles[0]?.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test.each(INVALID_DEPENDENCY_FILES)('invalid %s content %s gives no dependency file', async (path, content) => {
    await using sandbox = await createGitSandbox({ [path]: content, 'source.ts': 'export {};\n' });

    const files = [
        {
            path: path,
            kind: 'source' as const,
            kindOrigin: SOURCE_KIND.origin,
            tags: ['text'],
            executable: false,
            size: 1,
        },
    ];
    expect(await readDependencyFiles(createRunCache(sandbox.path), files)).toStrictEqual([]);
});

test('package.json reads keep your own fields and tell a missing file from invalid data', async () => {
    await using sandbox = await createGitSandbox({});
    expect(readPackageJson(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageJson(sandbox.path, 'package.json')).toStrictEqual(PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'parse' }),
    );
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('dependencies.next') as string,
        }),
    );
});

test('declared framework dependencies follow the nearest npm project', async () => {
    await using sandbox = await createGitSandbox(PROJECT_DEPENDENCY_FILES);

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
    for (const { scope, names } of PROJECT_DEPENDENCY_SCOPES) {
        expect(listProjectDependencyNames(dependencyFiles, scope), scope).toStrictEqual([...names]);
    }
});

test('a broken package.json stops the next session and a fixed one changes the scope dependencies', async () => {
    await using sandbox = await createGitSandbox({
        ...REACT_VUE_PACKAGES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            rules: true,
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
    });

    await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(await captureRejection(openSession(sandbox.path))).toMatchObject({ name: 'GspotError', code: 'parse' });
    await writeFile(join(sandbox.path, 'package.json'), ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    const reopened = await openSession(sandbox.path);
    expect(
        reopened.scopes.map((scope) => listProjectDependencyNames(reopened.repository.dependencyFiles, scope.path)),
    ).toStrictEqual([[], ['vue']]);
});

test.each([...PYTHON_DEPENDENCY_CASES])(
    'each Python dependency file form gives its dependencies: $name',
    async ({ path, source }) => {
        await using sandbox = await createGitSandbox({ [`api/${path}`]: source });
        const repository = await readTestRepository(sandbox.path);
        const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
        expect(Object.keys(dependencyFiles[0]!.dependencies).toSorted(compareText)).toStrictEqual([
            'fastapi',
            'friendly-bard',
        ]);
    },
);

test.each(['constructor', '__proto__'])('repository names do not access inherited tables: %s', async (name) => {
    await using sandbox = await createGitSandbox({
        [name]: 'authored source\n',
        script: `#!/usr/bin/env ${name}\nprintf "source\\n"\n`,
    });
    const repository = await readTestRepository(sandbox.path);
    expect(repository.files.find((file) => file.path === name)).toMatchObject({ kind: 'source', tags: ['text'] });
    expect(repository.files.find((file) => file.path === 'script')).toMatchObject({
        kind: 'source',
        tags: ['text'],
    });
    expect(await readDependencyFiles(createRunCache(sandbox.path), repository.files)).toStrictEqual([]);
});

test('optional runtime dependencies remain installed beside development tools', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"devDependencies":{"eslint":"9.0.0"},"optionalDependencies":{"react":"19.0.0"}}',
    });
    const files = await readDependencyFiles(createRunCache(sandbox.path), [
        {
            path: 'package.json',
            kind: 'source' as const,
            kindOrigin: SOURCE_KIND.origin,
            tags: ['text'],
            executable: false,
            size: 1,
        },
    ]);
    expect(files[0]?.installed).toStrictEqual({ eslint: '9.0.0', react: '19.0.0' });
});
