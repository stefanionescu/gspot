import * as files from 'node:fs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { captureThrow } from '#tests/setup/matchers.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { readHooks, readLintJobs, readExistingTools } from '#cli/repository/existing-tools.ts';

import {
    HUSKY_STUBS,
    LEFTHOOK_FILES,
    CI_JOB_DOCUMENTS,
    LINKED_HOOK_FILES,
    HOOK_FOLDER_FILES,
    LINKED_HOOK_FOLDERS,
    LINKED_RULE_FOLDERS,
    LINKED_RUFF_SECTION,
    PRETTIER_SETTINGS_FILES,
    SIMPLE_GIT_HOOKS_PACKAGES,
} from '#tests/data/repository/existing-tools.ts';

test('tool discovery finds nested tool files and skips root .gspot and vendored folders', async () => {
    await using sandbox = await testdir(PRETTIER_SETTINGS_FILES);

    const repository = await readTestRepository(sandbox.path);
    const discovered = readExistingTools(createReadCache(sandbox.path), {
        files: repository.files,
        dependencyFiles: [],
    });
    expect(discovered.replacedFiles.map((entry) => entry.path)).toStrictEqual(['src/.prettierrc.json']);
});

test.each([...CI_JOB_DOCUMENTS])('CI discovery recognizes $name', async ({ path, document, expected }) => {
    await using sandbox = await testdir({ [path]: JSON.stringify(document) });

    expect(readLintJobs(sandbox.path, [path, 'missing.yml'])).toStrictEqual(expected.map((name) => `${path}: ${name}`));
});

test('CI discovery reports malformed YAML', async () => {
    await using sandbox = await testdir();
    const path = '.gitlab-ci.yml';
    await createFileTree(sandbox.path, { [path]: 'quality: [unterminated' });
    expect(captureThrow(() => readLintJobs(sandbox.path, [path]))).toBe(
        '.gitlab-ci.yml is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 23:. Fix the file.',
    );
});

test('tool discovery reads tool sections through a link inside the repository', async () => {
    await using sandbox = await testdir();
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    await symlink('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const existingTools = readExistingTools(createReadCache(sandbox.path), { files: [], dependencyFiles: [] });
    expect(existingTools.replacedFiles).toContainEqual(LINKED_RUFF_SECTION);
});

test.each([...LINKED_RULE_FOLDERS])(
    'a linked %s counts as present without reading a rules folder outside',
    async (path) => {
        await using sandbox = await testdir({
            'project/source.ts': 'export {};\n',
            'outside/guide.md': 'external rules\n',
        });

        const root = join(sandbox.path, 'project');
        await mkdir(dirname(join(root, path)), { recursive: true });
        await symlink(join(sandbox.path, 'outside'), join(root, path), 'dir');
        expect(readExistingTools(createReadCache(root), { files: [], dependencyFiles: [] }).ruleFolders).toStrictEqual([
            path,
        ]);
        await unlink(join(root, path));
        await createFileTree(root, { [`${path}/guide.md`]: 'authored rules\n' });
        expect(readExistingTools(createReadCache(root), { files: [], dependencyFiles: [] }).ruleFolders).toStrictEqual([
            path,
        ]);
    },
);
test('hook discovery keeps spaces in core.hooksPath and refuses a broken Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await testdir({ [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
    expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] }]);
    const original = await readFile(join(sandbox.path, '.git/config'));
    await writeFile(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => readHooks(sandbox.path)).toThrow('Git config failed in ');
    await writeFile(join(sandbox.path, '.git/config'), original);
    expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] }]);
});
test('a hooks folder outside the repository that core.hooksPath names is listed', async () => {
    await using sandbox = await testdir({
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['config', 'core.hooksPath', '../hooks']);
    expect(readHooks(root)).toStrictEqual([{ kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] }]);
});
test('pre-commit is found from its configuration file', async () => {
    await using sandbox = await testdir({ '.pre-commit-config.yaml': 'repos: []\n' });

    expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'pre-commit', path: '.pre-commit-config.yaml', files: [] }]);
});
test('hook discovery refuses a malformed package.json and names it', async () => {
    await using sandbox = await testdir({ 'package.json': '{' });

    expect(captureThrow(() => readHooks(sandbox.path))).toBe(
        'package.json is not valid JSON: Invalid JSON at offset 1: CloseBraceExpected. Fix the file.',
    );
});
test('hook discovery reports other hook folders and leaves gspot and task scripts out', async () => {
    await using sandbox = await testdir(HOOK_FOLDER_FILES);

    const hooks = readHooks(sandbox.path);
    expect(hooks.toSorted((left, right) => left.path.localeCompare(right.path))).toStrictEqual([
        { kind: 'githooks', path: '.git-hooks', files: ['pre-commit'] },
        { kind: 'githooks', path: '.githooks', files: ['pre-commit'] },
        { kind: 'husky', path: '.husky', files: ['pre-commit'] },
    ]);
});
test('Husky 9 counts as Husky, and its stub folder is no hook file', async () => {
    await using sandbox = await testdir({ '.husky/pre-commit': 'npm test\n', ...HUSKY_STUBS });
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.husky/_']);
    expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'husky', path: '.husky', files: ['pre-commit'] }]);
});
test.each([...LINKED_HOOK_FOLDERS])(
    'a linked $path counts as $kind without reading hook files outside',
    async ({ path, kind }) => {
        await using sandbox = await testdir({
            'project/source.ts': 'export {};\n',
            'outside/pre-commit': '#!/bin/sh\nexit 0\n',
        });

        const root = join(sandbox.path, 'project');
        await symlink('../outside', join(root, path), 'dir');
        expect(readHooks(root)).toStrictEqual([{ kind, path, files: [] }]);
        await unlink(join(root, path));
        await createFileTree(root, { 'authored-hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
        await symlink('authored-hooks', join(root, path), 'dir');
        expect(readHooks(root)).toStrictEqual([{ kind, path, files: ['pre-commit'] }]);
    },
);
test.each([...LINKED_HOOK_FILES])('a linked $path counts as $kind configuration', async ({ path, kind }) => {
    await using sandbox = await testdir({
        'project/source.ts': 'export {};\n',
        'outside/configuration': 'authored hook configuration\n',
    });

    const root = join(sandbox.path, 'project');
    await symlink('../outside/configuration', join(root, path));
    expect(readHooks(root)).toStrictEqual([{ kind, path, files: [] }]);
});
test.each([...LEFTHOOK_FILES])(
    'hook discovery reports a lefthook file at %s, and nothing once it is deleted',
    async (path) => {
        await using sandbox = await testdir({
            [path]: 'authored hook configuration\n',
            'hook-settings.yaml': 'unrelated hook configuration\n',
            'source.ts': 'export {};\n',
        });

        expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'lefthook', path, files: [] }]);
        await unlink(join(sandbox.path, path));
        expect(readHooks(sandbox.path)).toStrictEqual([]);
    },
);
test('a read error in a hooks folder reaches the caller', async () => {
    await using sandbox = await testdir({ '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    const failure = Object.assign(new Error('Cannot read the authored hooks directory.'), { code: 'EIO' });
    using read = spyOn(files, 'readdirSync').mockImplementation(() => {
        throw failure;
    });
    let caught: unknown;
    try {
        readHooks(sandbox.path);
    } catch (error) {
        caught = error;
    }
    expect(caught).toBe(failure);
    expect(read).toHaveBeenCalledTimes(1);
});
test.each([...SIMPLE_GIT_HOOKS_PACKAGES])(
    'hook discovery reads simple-git-hooks from the package.json key: $text',
    async ({ text, hooks }) => {
        await using sandbox = await testdir({ 'package.json': text });
        expect(readHooks(sandbox.path)).toStrictEqual([...hooks]);
    },
);
test('hook discovery lists a hooks folder once when core.hooksPath names it by its absolute path', async () => {
    await using sandbox = await testdir({ '.githooks/pre-commit': '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', join(sandbox.path, '.githooks')]);
    expect(readHooks(sandbox.path)).toStrictEqual([{ kind: 'hooksPath', path: '.githooks', files: ['pre-commit'] }]);
});
