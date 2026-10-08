import * as files from 'node:fs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { getLintJobs } from '#cli/repository/survey.ts';
import { readRepository } from '#cli/repository/read.ts';
import { getTooling } from '#cli/configurations/takeover.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';

import {
    RUNNER_CASES,
    LEFTHOOK_FILES,
    LINKED_HOOK_FILES,
    SURVEY_READ_ERRORS,
    LINKED_HOOK_FOLDERS,
    LINKED_RULE_FOLDERS,
    PACKAGE_HOOK_CONFIGURATIONS,
} from '#tests/config/cli/configurations/takeover.ts';

test('hook discovery preserves path whitespace and refuses malformed Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    const original = await readFile(join(sandbox.path, '.git/config'));
    await writeFile(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => getTooling(sandbox.path, [], [])).toThrow('Git configuration core.hooksPath failed');
    await writeFile(join(sandbox.path, '.git/config'), original);
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
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
    expect(getTooling(root, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] },
    ]);
});

for (const value of PACKAGE_HOOK_CONFIGURATIONS)
    test(`simple-git-hooks is detected when its authored value is ${value}`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': `{"simple-git-hooks":${value}}\n` });
        expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
            { kind: 'simple-git-hooks', path: 'package.json', files: [] },
        ]);
    });

test('ast-grep adoption preserves a Qlty configuration', async () => {
    await using sandbox = await testdir();
    const source = 'foreign_tool = true\n';
    await createFileTree(sandbox.path, { '.qlty': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(getTooling(sandbox.path, repository.files, []).toolFiles).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, '.qlty'), 'utf8')).toBe(source);
});

test('pre-commit is detected from its native configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.pre-commit-config.yaml': 'repos: []\n' });
    const { files } = await readRepository(sandbox.path, [], [], []);
    expect(getTooling(sandbox.path, files, []).hooks).toStrictEqual([
        { kind: 'pre-commit', path: '.pre-commit-config.yaml', files: [] },
    ]);
});

test('adoption discovers nested authored configuration without adopting managed or vendored inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'src/.prettierrc.json': '{"semi":false}',
        'vendor/.prettierrc.json': '{"semi":true}',
        '.gspot/.prettierrc.json': '{"tabWidth":8}',
        '.gspot/package.json': 'unowned malformed output',
        'nested/.gspot/package.json': 'unowned nested output',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = getTooling(sandbox.path, repository.files, []);
    expect(discovered.toolFiles.map((entry) => entry.path)).toStrictEqual(['src/.prettierrc.json']);
});

test.each([
    {
        name: 'GitHub run steps',
        path: '.github/workflows/check.yml',
        document: {
            jobs: {
                quality: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'bun run lint' }, null, 12] },
                build: { steps: [{ run: 'bun run build' }] },
            },
        },
        expected: ['quality'],
    },
    {
        name: 'GitLab scalar and array scripts',
        path: '.gitlab-ci.yml',
        document: {
            quality: { script: 'eslint src' },
            analysis: { script: [null, 12, 'npm run lint'] },
            '.lint-template': { script: 'eslint src' },
            build: { script: ['bun run build'] },
        },
        expected: ['quality', 'analysis'],
    },
    {
        name: 'named inherited jobs',
        path: '.gitlab/ci/check.yml',
        document: {
            'code-lint': { extends: '.base' },
            unrelated: { extends: '.base' },
            'lint-settings': { variables: {} },
            'lint-invalid': [],
        },
        expected: ['code-lint'],
    },
    {
        name: 'script precedence over steps',
        path: '.github/workflows/check.yml',
        document: {
            jobs: {
                build: { script: 'bun run build', steps: [{ run: 'eslint src' }] },
                quality: { script: ['eslint src'], steps: [] },
            },
        },
        expected: ['quality'],
    },
    { name: 'null document', path: '.gitlab-ci.yml', document: null, expected: [] },
    { name: 'non-object jobs', path: '.github/workflows/check.yml', document: { jobs: 12 }, expected: [] },
])('CI discovery recognizes $name', async ({ path, document, expected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: JSON.stringify(document) });
    expect(getLintJobs(sandbox.path, [path, 'missing.yml'])).toStrictEqual(expected.map((name) => `${path}: ${name}`));
});

test('CI discovery reports malformed YAML and passes after the fix', async () => {
    await using sandbox = await testdir();
    const path = '.gitlab-ci.yml';
    await createFileTree(sandbox.path, { [path]: 'quality: [unterminated' });
    expect(() => getLintJobs(sandbox.path, [path])).toThrow();
    await writeFile(join(sandbox.path, path), 'quality:\n  script: eslint src\n');
    expect(getLintJobs(sandbox.path, [path])).toStrictEqual([`${path}: quality`]);
});

test('hook discovery ignores package content without a hook declaration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{}' });
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([]);
});

test('hook discovery rejects malformed package JSON and passes after the fix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    expect(() => getTooling(sandbox.path, [], [])).toThrow(SyntaxError);
    await writeFile(join(sandbox.path, 'package.json'), '{"simple-git-hooks":{}}');
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'simple-git-hooks', path: 'package.json', files: [] },
    ]);
});

test('tool discovery reads linked authored sections inside the repository without changing their targets', async () => {
    await using sandbox = await testdir();
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    await symlink('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const tooling = getTooling(sandbox.path, [], []);
    expect(tooling.toolFiles).toContainEqual({
        tool: 'ruff',
        path: 'pyproject.toml',
        shared: true,
        table: 'tool.ruff',
    });
});

test('hook discovery reports foreign folders and leaves managed and task scripts available for installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.husky/pre-commit': '#!/bin/sh\nexit 0\n',
        '.git-hooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.gspot/hooks/pre-commit': '#!/bin/sh\nexit 0\n',
        '.mise/tasks/hook/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const hooks = getTooling(sandbox.path, [], []).hooks;
    expect(hooks.toSorted((left, right) => left.path.localeCompare(right.path))).toStrictEqual([
        { kind: 'githooks', path: '.git-hooks', files: ['pre-commit'] },
        { kind: 'githooks', path: '.githooks', files: ['pre-commit'] },
        { kind: 'husky', path: '.husky', files: ['pre-commit'] },
    ]);
});

test.skipIf(!isPosix).each(LINKED_HOOK_FOLDERS)(
    'a linked $path counts as $kind without exposing external hook files',
    async ({ path, kind }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/pre-commit': '#!/bin/sh\nexit 0\n',
        });
        const root = join(sandbox.path, 'project');
        await symlink('../outside', join(root, path), 'dir');
        expect(getTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: [] }]);
        await unlink(join(root, path));
        await createFileTree(root, { 'authored-hooks/pre-commit': '#!/bin/sh\nexit 0\n' });
        await symlink('authored-hooks', join(root, path), 'dir');
        expect(getTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: ['pre-commit'] }]);
    },
);

test.skipIf(!isPosix).each(LINKED_RULE_FOLDERS)(
    'a linked %s counts as present without reading an external rules folder',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/guide.md': 'external rules\n',
        });
        const root = join(sandbox.path, 'project');
        await mkdir(dirname(join(root, path)), { recursive: true });
        await symlink(join(sandbox.path, 'outside'), join(root, path), 'dir');
        expect(getTooling(root, [], []).rulesDirectories).toStrictEqual([path]);
        await unlink(join(root, path));
        await createFileTree(root, { [`${path}/guide.md`]: 'authored rules\n' });
        expect(getTooling(root, [], []).rulesDirectories).toStrictEqual([path]);
    },
);

test.skipIf(!isPosix).each(LINKED_HOOK_FILES)(
    'a linked $path counts as $kinds external configuration',
    async ({ path, kind }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/configuration': 'authored hook configuration\n',
        });
        const root = join(sandbox.path, 'project');
        await symlink('../outside/configuration', join(root, path));
        expect(getTooling(root, [], []).hooks).toStrictEqual([{ kind, path, files: [] }]);
    },
);

test.each(LEFTHOOK_FILES)('hook discovery reports %s and preserves authored bytes', async (path) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [path]: 'authored hook configuration\n',
        'hook-settings.yaml': 'unrelated hook configuration\n',
        'source.ts': 'export {};\n',
    });
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([{ kind: 'lefthook', path, files: [] }]);
    await unlink(join(sandbox.path, path));
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([]);
});

test.each(SURVEY_READ_ERRORS)('tool discovery propagates a contained directory %s read failure', async (code) => {
    await using sandbox = await testdir({ '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    const failure = Object.assign(new Error('Cannot read the authored hooks directory.'), { code });
    using read = spyOn(files, 'readdirSync').mockImplementation(() => {
        throw failure;
    });
    let caught: unknown;
    try {
        getTooling(sandbox.path, [], []);
    } catch (error) {
        caught = error;
    }
    expect(caught).toBe(failure);
    expect(read).toHaveBeenCalledTimes(1);
});

test.each(RUNNER_CASES)(
    '$name reports $runner without inventing a runner file',
    async ({ paths, runner, runnerFile }) => {
        await using sandbox = await testdir();
        const tree: Record<string, string> = Object.fromEntries(
            paths.map((path) => [path, path.endsWith('.json') ? '{}\n' : ''] as const),
        );
        tree['source.ts'] = 'export {};\n';
        await createFileTree(sandbox.path, tree);
        const repository = await readRepository(sandbox.path, [], [], []);
        const tooling = getTooling(sandbox.path, repository.files, []);
        expect(tooling.runner).toBe(runner);
        expect(tooling.runnerFile).toBe(runnerFile);
        expect(Object.hasOwn(tooling, 'runnerFile')).toBe(runnerFile !== undefined);
    },
);
