import * as files from 'node:fs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGitStep } from '#tests/setup/system/git.ts';
import { PACKAGE_JSON_ERROR } from '#tests/config/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { chmod, mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { readHooks, readLintJobs, readRepositorySetup } from '#cli/repository/setup.ts';

import {
    HUSKY_STUBS,
    LEFTHOOK_FILES,
    CI_JOB_DOCUMENTS,
    GITLAB_COMPONENT,
    LINKED_HOOK_FILES,
    HOOK_FOLDER_FILES,
    LINKED_HOOK_FOLDERS,
    LINKED_RULE_FOLDERS,
    LINKED_RUFF_SECTION,
    PRETTIER_SETTINGS_FILES,
    SIMPLE_GIT_HOOKS_PACKAGES,
} from '#tests/config/repository/setup.ts';

test('tool discovery finds nested config files and skips root .gspot and vendored folders', async () => {
    await using sandbox = await testdir(PRETTIER_SETTINGS_FILES);

    const repository = await readTestRepository(sandbox.path);
    const discovered = readRepositorySetup(createReadCache(sandbox.path), {
        hasGit: repository.hasGit,
        files: repository.files,
        dependencyFiles: [],
    });
    expect(discovered.conflictingConfigFiles.map((conflictingConfigFile) => conflictingConfigFile.path)).toStrictEqual([
        'src/.prettierrc.json',
    ]);
});

test.each([...CI_JOB_DOCUMENTS])('CI discovery recognizes $name', async ({ path, document, expected }) => {
    await using sandbox = await testdir({ [path]: JSON.stringify(document) });

    expect(readLintJobs(sandbox.path, [path, 'missing.yml'])).toStrictEqual(expected.map((name) => `${path}: ${name}`));
});

test('CI discovery reports malformed YAML', async () => {
    await using sandbox = await testdir();
    const path = '.gitlab-ci.yml';
    await createFileTree(sandbox.path, { [path]: 'quality: [unterminated' });
    const error = await captureRejection(Promise.try(() => readLintJobs(sandbox.path, [path])));
    expect(error).toMatchObject({ name: 'GspotError', code: 'parse' });
    expect(error.message).toStartWith('.gitlab-ci.yml is not valid YAML: ');
});

test('CI discovery reads jobs after a GitLab component specification and keeps reference tags quiet', async () => {
    await using sandbox = await testdir({ '.gitlab/ci/quality.yml': GITLAB_COMPONENT });
    const warnings: string[] = [];
    using _warnings = spyOn(process, 'emitWarning').mockImplementation((warning) => {
        warnings.push(String(warning));
    });
    expect(readLintJobs(sandbox.path, ['.gitlab/ci/quality.yml'])).toStrictEqual(['.gitlab/ci/quality.yml: quality']);
    expect(warnings).toStrictEqual([]);
});

test('tool discovery reads tool sections through a link inside the repository', async () => {
    await using sandbox = await testdir();
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    await symlink('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const repositorySetup = readRepositorySetup(createReadCache(sandbox.path), {
        hasGit: false,
        files: [],
        dependencyFiles: [],
    });
    expect(repositorySetup.conflictingConfigFiles).toStrictEqual([LINKED_RUFF_SECTION]);
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
        expect(
            readRepositorySetup(createReadCache(root), { hasGit: false, files: [], dependencyFiles: [] }).ruleFolders,
        ).toStrictEqual([path]);
        await unlink(join(root, path));
        await createFileTree(root, { [`${path}/guide.md`]: 'authored rules\n' });
        expect(
            readRepositorySetup(createReadCache(root), { hasGit: false, files: [], dependencyFiles: [] }).ruleFolders,
        ).toStrictEqual([path]);
    },
);

test('hook discovery keeps spaces in core.hooksPath and refuses a broken Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await createGitSandbox({ [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
    expect(readHooks({ root: sandbox.path, hasGit: true }).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    const previous = await readFile(join(sandbox.path, '.git/config'));
    await writeFile(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => readHooks({ root: sandbox.path, hasGit: true }).hooks).toThrow('Git config failed in ');
    await writeFile(join(sandbox.path, '.git/config'), previous);
    expect(readHooks({ root: sandbox.path, hasGit: true }).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
});

test('a hooks folder outside the repository that core.hooksPath names is listed', async () => {
    await using sandbox = await testdir({
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });

    const root = join(sandbox.path, 'project');
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['config', 'core.hooksPath', '../hooks']);
    expect(readHooks({ root: root, hasGit: true }).hooks).toStrictEqual([
        { kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] },
    ]);
});

test('pre-commit is found from its configuration file', async () => {
    await using sandbox = await testdir({ '.pre-commit-config.yaml': 'repos: []\n' });

    expect(readHooks({ root: sandbox.path, hasGit: false }).hooks).toStrictEqual([
        { kind: 'pre-commit', path: '.pre-commit-config.yaml', files: [] },
    ]);
});

test('hook discovery refuses a malformed package.json and names it', async () => {
    await using sandbox = await testdir({ 'package.json': '{' });

    expect(() => readHooks({ root: sandbox.path, hasGit: false }).hooks).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'parse',
            message: PACKAGE_JSON_ERROR,
        }),
    );
});

test('hook discovery reports other hook folders and leaves gspot and task scripts out', async () => {
    await using sandbox = await testdir(HOOK_FOLDER_FILES);

    const hooks = readHooks({ root: sandbox.path, hasGit: false }).hooks;
    expect(hooks.toSorted((left, right) => left.path.localeCompare(right.path))).toStrictEqual([
        { kind: 'githooks', path: '.git-hooks', files: ['pre-commit'] },
        { kind: 'githooks', path: '.githooks', files: ['pre-commit'] },
        { kind: 'husky', path: '.husky', files: ['pre-commit'] },
    ]);
});

test('Husky 9 counts as Husky, and its stub folder is no hook file', async () => {
    await using sandbox = await createGitSandbox({ '.husky/pre-commit': 'npm test\n', ...HUSKY_STUBS });
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.husky/_']);
    expect(readHooks({ root: sandbox.path, hasGit: true }).hooks).toStrictEqual([
        { kind: 'husky', path: '.husky', files: ['pre-commit'] },
    ]);
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
        expect(readHooks({ root: root, hasGit: false }).hooks).toStrictEqual([]);
        await unlink(join(root, path));
        await createFileTree(root, { 'authored-hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
        await symlink('authored-hooks', join(root, path), 'dir');
        expect(readHooks({ root: root, hasGit: false }).hooks).toStrictEqual([{ kind, path, files: ['pre-commit'] }]);
    },
);

test.each([...LINKED_HOOK_FILES])('a linked $path counts as $kind configuration', async ({ path, kind }) => {
    await using sandbox = await testdir({
        'project/source.ts': 'export {};\n',
        'outside/configuration': 'authored hook configuration\n',
    });

    const root = join(sandbox.path, 'project');
    await symlink('../outside/configuration', join(root, path));
    expect(readHooks({ root: root, hasGit: false }).hooks).toStrictEqual([{ kind, path, files: [] }]);
});

test.each([...LEFTHOOK_FILES])(
    'hook discovery reports a lefthook file at %s, and nothing once it is deleted',
    async (path) => {
        await using sandbox = await testdir({
            [path]: 'authored hook configuration\n',
            'hook-settings.yaml': 'unrelated hook configuration\n',
            'source.ts': 'export {};\n',
        });

        expect(readHooks({ root: sandbox.path, hasGit: false }).hooks).toStrictEqual([
            { kind: 'lefthook', path, files: [] },
        ]);
        await unlink(join(sandbox.path, path));
        expect(readHooks({ root: sandbox.path, hasGit: false }).hooks).toStrictEqual([]);
    },
);

test('a read error in a hooks folder reaches the caller', async () => {
    await using sandbox = await testdir({ '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    const failure = Object.assign(new Error('Cannot read the authored hooks directory.'), { code: 'EIO' });
    using _read = spyOn(files, 'readdirSync').mockImplementation(() => {
        throw failure;
    });
    expect(() => readHooks({ root: sandbox.path, hasGit: false }).hooks).toThrow(
        matchFields<Error & { code: string }>({
            name: 'Error',
            code: 'EIO',
            message: 'Cannot read the authored hooks directory.',
        }),
    );
});

test.each([...SIMPLE_GIT_HOOKS_PACKAGES])(
    'hook discovery reads simple-git-hooks from the package.json key: $text',
    async ({ text, hooks }) => {
        await using sandbox = await testdir({ 'package.json': text });
        expect(readHooks({ root: sandbox.path, hasGit: false }).hooks).toStrictEqual([...hooks]);
    },
);

test('hook discovery lists a hooks folder once when core.hooksPath names it by its absolute path', async () => {
    await using sandbox = await createGitSandbox({ '.githooks/pre-commit': '#!/bin/sh\nexit 0\n' });

    runGitStep(sandbox.path, ['config', 'core.hooksPath', join(sandbox.path, '.githooks')]);
    expect(readHooks({ root: sandbox.path, hasGit: true }).hooks).toStrictEqual([
        { kind: 'hooksPath', path: '.githooks', files: ['pre-commit'] },
    ]);
});

test('hook discovery includes executable Git hooks and leaves gspot hooks out', async () => {
    await using sandbox = await createGitSandbox({ '.git/hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
    await chmod(join(sandbox.path, '.git/hooks/pre-commit'), 0o755);
    const hooks = [{ kind: 'hooksPath' as const, path: '.git/hooks', files: ['pre-commit'] }];
    expect(readHooks({ root: sandbox.path, hasGit: true })).toStrictEqual({ hooksPath: '', hooks });
    expect(
        readRepositorySetup(createReadCache(sandbox.path), { hasGit: true, files: [], dependencyFiles: [] }).hooks,
    ).toStrictEqual(hooks);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
    expect(readHooks({ root: sandbox.path, hasGit: true })).toStrictEqual({ hooksPath: '.gspot/hooks', hooks: [] });
});
