import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { mkdir, unlink, symlink } from 'node:fs/promises';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { LINKED_RULE_FOLDERS } from '#tests/data/repository/existing-tools.ts';
import { readLintJobs, hasIniSection, readExistingTools } from '#cli/repository/existing-tools.ts';

test('tool discovery finds nested tool files and skips root .gspot and vendored folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'src/.prettierrc.json': '{"semi":false}',
        'vendor/.prettierrc.json': '{"semi":true}',
        '.gspot/.prettierrc.json': '{"tabWidth":8}',
        '.gspot/package.json': 'unowned malformed output',
        'nested/.gspot/package.json': '{}',
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    const discovered = readExistingTools(sandbox.path, repository.files, []);
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
    expect(readLintJobs(sandbox.path, [path, 'missing.yml'])).toStrictEqual(expected.map((name) => `${path}: ${name}`));
});

test('CI discovery reports malformed YAML', async () => {
    await using sandbox = await testdir();
    const path = '.gitlab-ci.yml';
    await createFileTree(sandbox.path, { [path]: 'quality: [unterminated' });
    expect(() => readLintJobs(sandbox.path, [path])).toThrow(`Cannot read CI configuration ${path}:`);
});

test('tool discovery reads tool sections through a link inside the repository', async () => {
    await using sandbox = await testdir();
    const source = '[tool.ruff]\nline-length = 100\n';
    await createFileTree(sandbox.path, { 'settings/python.toml': source });
    await symlink('settings/python.toml', join(sandbox.path, 'pyproject.toml'));
    const tooling = readExistingTools(sandbox.path, [], []);
    expect(tooling.toolFiles).toContainEqual({
        tool: 'ruff',
        path: 'pyproject.toml',
        shared: true,
        table: 'tool.ruff',
    });
});

test.each([...LINKED_RULE_FOLDERS])(
    'a linked %s counts as present without reading a rules folder outside',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'project/source.ts': 'export {};\n',
            'outside/guide.md': 'external rules\n',
        });
        const root = join(sandbox.path, 'project');
        await mkdir(dirname(join(root, path)), { recursive: true });
        await symlink(join(sandbox.path, 'outside'), join(root, path), 'dir');
        expect(readExistingTools(root, [], []).ruleFolders).toStrictEqual([path]);
        await unlink(join(root, path));
        await createFileTree(root, { [`${path}/guide.md`]: 'authored rules\n' });
        expect(readExistingTools(root, [], []).ruleFolders).toStrictEqual([path]);
    },
);

test('an INI file has a section, or a subsection of it, only under an exact heading', () => {
    const selected =
        '[tool] # selected\r\nkey = value\r\n[other] trailing text\r\n[]\r\n[tool:child]; nested\r\nvalue = 2\r';
    expect(hasIniSection(`[unrelated]\r\nvalue = 1\r\n${selected}\n[toolbox]\nvalue = 3\n`, 'tool')).toBe(true);
    expect(hasIniSection('[toolbox]\nvalue = 3\n', 'tool')).toBe(false);
    expect(hasIniSection('[tool\nvalue = 3\n', 'tool')).toBe(false);
});
