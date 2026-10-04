import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import { readRepository } from '#cli/repository/read.ts';
import { getTooling } from '#cli/configurations/takeover.ts';
import { unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { PACKAGE_HOOK_CONFIGURATIONS } from '#tests/config/cli/repository/existing-tooling.ts';

test('hook discovery preserves path whitespace and refuses malformed Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });
    const initialized = runBlocking(['git', 'init', '-q'], { cwd: sandbox.path });
    expect(initialized.code, initialized.stderr).toBe(0);
    const configured = runBlocking(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path });
    expect(configured.code, configured.stderr).toBe(0);
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    const original = readFileSync(join(sandbox.path, '.git/config'));
    writeFileSync(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => getTooling(sandbox.path, [], [])).toThrow('Git configuration core.hooksPath failed');
    writeFileSync(join(sandbox.path, '.git/config'), original);
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
});

test('tool discovery reports linked hook directories without following external files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/README.md': 'project\n',
        'outside/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const root = join(sandbox.path, 'project');
    symlinkSync('../outside', join(root, '.husky'));
    expect(getTooling(root, [], []).hooks).toStrictEqual([{ kind: 'husky', path: '.husky', files: [] }]);
    expect(readFileSync(join(sandbox.path, 'outside/pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 0\n');
    unlinkSync(join(root, '.husky'));
    await createFileTree(root, { '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    expect(getTooling(root, [], []).hooks).toStrictEqual([{ kind: 'husky', path: '.husky', files: ['pre-commit'] }]);
});

test('tool discovery reads an external hook directory only through the Git-resolved boundary', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const root = join(sandbox.path, 'project');
    expect(runBlocking(['git', 'init', '-q'], { cwd: root }).code).toBe(0);
    expect(runBlocking(['git', 'config', 'core.hooksPath', '../hooks'], { cwd: root }).code).toBe(0);
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

test('pre-commit is detected from its native configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.pre-commit-config.yaml': 'repos: []\n' });
    const files = [
        {
            path: '.pre-commit-config.yaml',
            kind: 'source' as const,
            tags: [],
            prefix: Buffer.from('repos: []'),
            kindSource: 'default' as const,
            executable: false,
            size: 10,
        },
    ];
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
    expect(discovered.configs.map((entry) => entry.path)).toStrictEqual(['src/.prettierrc.json']);
    expect(readFileSync(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe('unowned malformed output');
    expect(readFileSync(join(sandbox.path, 'vendor/.prettierrc.json'), 'utf8')).toBe('{"semi":true}');
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

test('CI discovery reports malformed YAML and accepts its correction', async () => {
    await using sandbox = await testdir();
    const path = '.gitlab-ci.yml';
    await createFileTree(sandbox.path, { [path]: 'quality: [unterminated' });
    expect(() => getLintJobs(sandbox.path, [path])).toThrow();
    writeFileSync(join(sandbox.path, path), 'quality:\n  script: eslint src\n');
    expect(getLintJobs(sandbox.path, [path])).toStrictEqual([`${path}: quality`]);
});

test('hook discovery ignores package content without a hook declaration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{}' });
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([]);
});

test('hook discovery rejects malformed package JSON and accepts its correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    expect(() => getTooling(sandbox.path, [], [])).toThrow(SyntaxError);
    writeFileSync(join(sandbox.path, 'package.json'), '{"simple-git-hooks":{}}');
    expect(getTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'simple-git-hooks', path: 'package.json', files: [] },
    ]);
});

test('tool discovery reads linked authored sections inside the repository without changing their targets', async () => {
    await using sandbox = await testdir();
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    symlinkSync('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const tooling = getTooling(sandbox.path, [], []);
    expect(tooling.configs).toContainEqual({
        tool: 'ruff',
        path: 'pyproject.toml',
        shared: true,
        table: 'tool.ruff',
    });
    expect(readFileSync(join(sandbox.path, 'settings/python.toml'), 'utf8')).toBe(source);
});
