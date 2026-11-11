import { chmod, mkdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { readHooks, readRepositorySetup } from '#cli/repository/setup.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { compareText } from '#cli/system/text.ts';
import {
    HOOK_FOLDER_FILES,
    LINKED_RUFF_SECTION,
    PRETTIER_SETTINGS_FILES,
    SIMPLE_GIT_HOOKS_PACKAGES,
} from '#tests/config/repository/setup.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('tool discovery finds nested config files and skips root .gspot and vendored folders', async () => {
    await using sandbox = await createGitSandbox(PRETTIER_SETTINGS_FILES);

    const repository = await readTestRepository(sandbox.path);
    const discovered = await readRepositorySetup(createRunCache(sandbox.path), { files: repository.files });
    expect(discovered.conflictingConfigs.map((conflictingConfig) => conflictingConfig.path)).toStrictEqual([
        'src/.prettierrc.json',
    ]);
});

test('tool discovery reads tool sections through a link inside the repository', async () => {
    await using sandbox = await createGitSandbox({});
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    await symlink('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const repositorySetup = await readRepositorySetup(createRunCache(sandbox.path), { files: [] });
    expect(repositorySetup.conflictingConfigs).toStrictEqual([LINKED_RUFF_SECTION]);
});

test('a linked .claude/rules counts as present without reading a rules folder outside', async () => {
    const path = '.claude/rules';
    await using sandbox = await createGitSandbox({
        'project/source.ts': 'export {};\n',
        'outside/guide.md': 'external rules\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await mkdir(dirname(join(root, path)), { recursive: true });
    await symlink(join(sandbox.path, 'outside'), join(root, path), 'dir');
    const linked = await readRepositorySetup(createRunCache(root), { files: [] });
    expect(linked.ruleFolders).toStrictEqual([path]);
    await unlink(join(root, path));
    await createFileTree(root, { [`${path}/guide.md`]: 'authored rules\n' });
    const authored = await readRepositorySetup(createRunCache(root), { files: [] });
    expect(authored.ruleFolders).toStrictEqual([path]);
});

test('hook discovery keeps spaces in core.hooksPath and refuses a broken Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await createGitSandbox({ [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
    const { hooks } = await readHooks({ root: sandbox.path });
    expect(hooks).toStrictEqual([{ kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] }]);
    await writeFile(join(sandbox.path, '.git/config'), '[core\n');
    const configError = await captureRejection(readHooks({ root: sandbox.path }));
    expect(configError).toMatchObject({ name: 'GspotError', code: 'git' });
});

test('a hooks folder outside the repository that core.hooksPath names is listed', async () => {
    await using sandbox = await createGitSandbox({
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['config', 'core.hooksPath', '../hooks']);
    const { hooks } = await readHooks({ root: root });
    expect(hooks).toStrictEqual([{ kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] }]);
});

test('hook discovery reports only the hook folder that core.hooksPath points into, and leaves gspot and task scripts out', async () => {
    await using sandbox = await createGitSandbox(HOOK_FOLDER_FILES);

    const { hooks } = await readHooks({ root: sandbox.path });
    expect(hooks).toStrictEqual([]);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.husky/_']);
    const husky = await readHooks({ root: sandbox.path });
    expect(husky.hooks).toStrictEqual([{ kind: 'husky', path: '.husky', files: ['pre-commit'] }]);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.githooks/_']);
    const own = await readHooks({ root: sandbox.path });
    expect(own.hooks.toSorted((left, right) => compareText(left.path, right.path))).toStrictEqual([
        { kind: 'githooks', path: '.githooks', files: ['pre-commit'] },
        { kind: 'hooksPath', path: '.githooks/_', files: [] },
    ]);
});

test('a linked .githooks that core.hooksPath points into counts as githooks without reading hook files outside', async () => {
    const path = '.githooks';
    await using sandbox = await createGitSandbox({
        'project/source.ts': 'export {};\n',
        'outside/pre-commit': '#!/bin/sh\nexit 0\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['config', 'core.hooksPath', `${path}/_`]);
    await symlink('../outside', join(root, path), 'dir');
    const linked = await readHooks({ root: root });
    expect(linked.hooks.filter(({ kind }) => kind === 'githooks')).toStrictEqual([]);
    await unlink(join(root, path));
    await createFileTree(root, { 'authored-hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
    await symlink('authored-hooks', join(root, path), 'dir');
    const authored = await readHooks({ root: root });
    expect(authored.hooks.filter(({ kind }) => kind === 'githooks')).toStrictEqual([
        { kind: 'githooks', path, files: ['pre-commit'] },
    ]);
});

test('a linked .lefthook.yml counts as lefthook configuration', async () => {
    await using sandbox = await createGitSandbox({
        'project/source.ts': 'export {};\n',
        'outside/configuration': 'authored hook configuration\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    await symlink('../outside/configuration', join(root, '.lefthook.yml'));
    await writeFile(join(root, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
    await chmod(join(root, '.git/hooks/pre-commit'), 0o755);
    const { hooks } = await readHooks({ root: root });
    expect(hooks).toStrictEqual([
        { kind: 'lefthook', path: '.lefthook.yml', files: [] },
        { kind: 'hooksPath', path: '.git/hooks', files: ['pre-commit'] },
    ]);
});

test.each([...SIMPLE_GIT_HOOKS_PACKAGES])(
    'hook discovery reads simple-git-hooks from the package.json key: $text',
    async ({ text, hooks }) => {
        await using sandbox = await createGitSandbox({ 'package.json': text });
        await writeFile(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
        await chmod(join(sandbox.path, '.git/hooks/pre-commit'), 0o755);
        const discovered = await readHooks({ root: sandbox.path });
        expect(discovered.hooks).toStrictEqual([
            ...hooks,
            { kind: 'hooksPath', path: '.git/hooks', files: ['pre-commit'] },
        ]);
    },
);

test('hook discovery lists a hooks folder once when core.hooksPath names it by its absolute path', async () => {
    await using sandbox = await createGitSandbox({ '.githooks/pre-commit': '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['config', 'core.hooksPath', join(sandbox.path, '.githooks')]);
    const { hooks } = await readHooks({ root: sandbox.path });
    expect(hooks).toStrictEqual([{ kind: 'hooksPath', path: '.githooks', files: ['pre-commit'] }]);
});

test('hook discovery includes executable Git hooks and leaves gspot hooks out', async () => {
    await using sandbox = await createGitSandbox({ '.git/hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
    await chmod(join(sandbox.path, '.git/hooks/pre-commit'), 0o755);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
    expect(await readHooks({ root: sandbox.path })).toStrictEqual({
        hooksPath: '.gspot/hooks',
        hooks: [],
    });
});
