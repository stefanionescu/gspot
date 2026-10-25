import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import type { GspotError } from '#cli/system/errors.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { PYTHON_DEPENDENCY_CASES } from '#tests/config/repository/samples.ts';
import { buildTrackedFile, readTestRepository } from '#tests/setup/cli/repository.ts';
import { readPackageJson, readDependencyFiles, listProjectDependencyNames } from '#cli/repository/dependencies.ts';

import {
    PACKAGE_FIELDS,
    REACT_VUE_PACKAGES,
    INVALID_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_FILES,
    PROJECT_DEPENDENCY_SCOPES,
    ROOT_PACKAGE_WITHOUT_DEPENDENCIES,
} from '#tests/config/repository/dependencies.ts';

test('Python dependency groups with includes keep every dependency', async () => {
    await using sandbox = await testdir({
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
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    expect(dependencyFiles[0]?.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test.each(INVALID_DEPENDENCY_FILES)(
    'invalid %s content %s is a dependency file error',
    async (path, content, message) => {
        await using sandbox = await testdir({ [path]: content, 'source.ts': 'export {};\n' });

        const files = [buildTrackedFile(path)];
        const error = await captureRejection(readDependencyFiles(createReadCache(sandbox.path), files));
        expect(error).toMatchObject({
            name: 'GspotError',
            code: 'filesystem',
            message,
            cause: expect.any(Error) as Error,
        });
    },
);

test('a dependency file that disappears after the repository read is an error', async () => {
    const path = 'pyproject.toml';
    await using sandbox = await testdir({ [path]: '' });

    const repository = await readTestRepository(sandbox.path);
    await rm(join(sandbox.path, path));
    const error = await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files));
    expect(error).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
        message: 'pyproject.toml is tracked but missing. Restore it or commit its deletion.',
    });
    await mkdir(join(sandbox.path, path));
    const readError = await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files));
    expect(readError).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
        message: 'pyproject.toml could not be read. Check the file and its permissions.',
        cause: expect.any(Error) as Error,
    });
});

test('package.json reads keep your own fields and tell a missing file from invalid data', async () => {
    await using sandbox = await testdir();
    expect(readPackageJson(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageJson(sandbox.path, 'package.json')).toStrictEqual(PACKAGE_FIELDS);
    const repository = await readTestRepository(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
        }),
    );
    const error = await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files));
    expect(error).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
        message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
    });
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: 'package.json: dependencies.next: Invalid input: expected string, received number. Fix the field.',
        }),
    );
    await rm(join(sandbox.path, 'package.json'));
    const readError = await captureRejection(readDependencyFiles(createReadCache(sandbox.path), repository.files));
    expect(readError).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
        message: 'package.json is tracked but missing. Restore it or commit its deletion.',
    });
});

test('declared framework dependencies follow the nearest npm project', async () => {
    await using sandbox = await testdir(PROJECT_DEPENDENCY_FILES);

    const repository = await readTestRepository(sandbox.path);
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    for (const { scope, names } of PROJECT_DEPENDENCY_SCOPES) {
        expect(listProjectDependencyNames(dependencyFiles, scope), scope).toStrictEqual([...names]);
    }
});

test('a broken package.json stops the next session and a fixed one changes the scope dependencies', async () => {
    await using sandbox = await testdir({
        ...REACT_VUE_PACKAGES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            rules: true,
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
    });

    await openSession(sandbox.path);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(await captureRejection(openSession(sandbox.path))).toMatchObject({
        name: 'GspotError',
        code: 'filesystem',
        message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
    });
    await writeFile(join(sandbox.path, 'package.json'), ROOT_PACKAGE_WITHOUT_DEPENDENCIES);
    const reopened = await openSession(sandbox.path);
    expect(
        reopened.scopes.map((scope) => listProjectDependencyNames(reopened.repository.dependencyFiles, scope.path)),
    ).toStrictEqual([[], ['vue']]);
});

test.each([...PYTHON_DEPENDENCY_CASES])(
    'each Python dependency file form gives its dependencies: $name',
    async ({ path, source }) => {
        await using sandbox = await testdir({ [`api/${path}`]: source });
        const repository = await readTestRepository(sandbox.path);
        const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
        expect(
            Object.keys(dependencyFiles[0]!.dependencies).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['fastapi', 'friendly-bard']);
    },
);

test.each(['constructor', 'toString', '__proto__'])(
    'repository names do not access inherited tables: %s',
    async (name) => {
        await using sandbox = await testdir({
            [name]: 'authored source\n',
            script: `#!/usr/bin/env ${name}\nprintf "source\\n"\n`,
        });
        const repository = await readTestRepository(sandbox.path);
        expect(repository.files.find((file) => file.path === name)).toMatchObject({ kind: 'source', tags: ['text'] });
        expect(repository.files.find((file) => file.path === 'script')).toMatchObject({
            kind: 'source',
            tags: ['text'],
        });
        expect(await readDependencyFiles(createReadCache(sandbox.path), repository.files)).toStrictEqual([]);
    },
);
