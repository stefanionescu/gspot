import * as files from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { readTooling } from '#cli/repository/tooling.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { LEFTHOOK_FILES, LINKED_HOOK_FILES, LINKED_HOOK_FOLDERS } from '#tests/config/tooling.ts';

test('hook discovery keeps spaces in core.hooksPath and refuses a broken Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    const original = await readFile(join(sandbox.path, '.git/config'));
    await writeFile(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => readTooling(sandbox.path, [], [])).toThrow('Git configuration core.hooksPath failed');
    await writeFile(join(sandbox.path, '.git/config'), original);
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
});

test('a hooks folder outside the repository that core.hooksPath names is listed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const root = join(sandbox.path, 'project');
    gitOutput(root, ['init', '-q']);
    gitOutput(root, ['config', 'core.hooksPath', '../hooks']);
    expect(readTooling(root, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] },
    ]);
});

test('pre-commit is found from its configuration file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.pre-commit-config.yaml': 'repos: []\n' });
    const { files } = await readRepository(sandbox.path, {
        declarations: [],
        scopeEntries: [],
        manifests: configurationManifests(),
        reads: createReadCache(sandbox.path),
    });
    expect(readTooling(sandbox.path, files, []).hooks).toStrictEqual([
        { kind: 'pre-commit', path: '.pre-commit-config.yaml', files: [] },
    ]);
});

test('hook discovery ignores a package.json without hooks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{}' });
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([]);
});

test('hook discovery refuses a malformed package.json', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    expect(() => readTooling(sandbox.path, [], [])).toThrow(SyntaxError);
    expect(() => readTooling(sandbox.path, [], [])).toThrow('package.json');
});

test('hook discovery reports other hook folders and leaves gspot and task scripts out', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.husky/pre-commit': '#!/bin/sh\nexit 0\n',
        '.git-hooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.gspot/hooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.mise/tasks/hook/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const hooks = readTooling(sandbox.path, [], []).hooks;
    expect(hooks.toSorted((left, right) => left.path.localeCompare(right.path))).toStrictEqual([
        { kind: 'githooks', path: '.git-hooks', files: ['pre-commit'] },
        { kind: 'githooks', path: '.githooks', files: ['pre-commit'] },
        { kind: 'husky', path: '.husky', files: ['pre-commit'] },
    ]);
});

test.each([...LINKED_HOOK_FOLDERS])(
    'a linked $path counts as $kind without reading hook files outside',
    async ({ path, kind }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/pre-commit': '#!/bin/sh\nexit 0\n',
        });
        const root = join(sandbox.path, 'project');
        await symlink('../outside', join(root, path), 'dir');
        expect(readTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: [] }]);
        await unlink(join(root, path));
        await createFileTree(root, { 'authored-hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
        await symlink('authored-hooks', join(root, path), 'dir');
        expect(readTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: ['pre-commit'] }]);
    },
);

test.each([...LINKED_HOOK_FILES])('a linked $path counts as $kind configuration', async ({ path, kind }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/source.ts': 'export {};\n',
        'outside/configuration': 'authored hook configuration\n',
    });
    const root = join(sandbox.path, 'project');
    await symlink('../outside/configuration', join(root, path));
    expect(readTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: [] }]);
});

test.each([...LEFTHOOK_FILES])('hook discovery reports %s', async (path) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [path]: 'authored hook configuration\n',
        'hook-settings.yaml': 'unrelated hook configuration\n',
        'source.ts': 'export {};\n',
    });
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([{ kind: 'lefthook', path, files: [] }]);
    await unlink(join(sandbox.path, path));
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([]);
});

test('a read error in a hooks folder reaches the caller', async () => {
    await using sandbox = await testdir({ '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    const failure = Object.assign(new Error('Cannot read the authored hooks directory.'), { code: 'EIO' });
    using read = spyOn(files, 'readdirSync').mockImplementation(() => {
        throw failure;
    });
    let caught: unknown;
    try {
        readTooling(sandbox.path, [], []);
    } catch (error) {
        caught = error;
    }
    expect(caught).toBe(failure);
    expect(read).toHaveBeenCalledTimes(1);
});

test('simple-git-hooks is found from its package.json key', async () => {
    await using sandbox = await testdir({ 'package.json': '{"simple-git-hooks":{"pre-commit":"echo authored"}}' });
    expect(readTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'simple-git-hooks', path: 'package.json', files: [] },
    ]);
});
