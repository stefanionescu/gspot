import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { compareText } from '#cli/system/text/order.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { TRACKED_SOURCE, PYTHON_DEPENDENCY_CASES } from '#tests/config/repository.ts';
import { readDependencyFiles, listProjectDependencyNames } from '#cli/repository/projects/dependencies.ts';

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

test.each(INVALID_DEPENDENCY_FILES)('invalid %s content %s gives no dependency file', async (path, content) => {
    await using sandbox = await createGitSandbox({ [path]: content, 'source.ts': 'export {};\n' });

    const files = [{ path, ...TRACKED_SOURCE }];
    expect(await readDependencyFiles(createRunCache(sandbox.path), files)).toStrictEqual([]);
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
