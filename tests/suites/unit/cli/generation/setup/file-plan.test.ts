import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { ATTRIBUTES_ROW, DROPPED_LINE_SETTINGS_NOTE, UNREAD_SUBMODULE_MESSAGE } from '#cli/config/generation/setup.ts';
import { formatInitPlan } from '#cli/generation/setup/file-plan.ts';
import { planInit } from '#cli/generation/setup/planner.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { applySandboxInit, planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const WORKSPACE_PYTHON_FILES = {
    'package.json': '{"private":true,"workspaces":["service"]}',
    'source.ts': 'export {};\n',
    'service/package.json': '{"private":true}',
    'service/main.py': 'value = 1\n',
} as const;

const QUALITY_PACKAGE_FILES = {
    'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
    'src/app.tsx': 'export const App = () => null;\n',
    'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
    'quality/check.ts': 'export const value = 1;\n',
    '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
} as const;

test.each([
    { name: 'a new .gitattributes under write', files: {}, attributes: 'write' },
    {
        name: 'an existing .gitattributes under change',
        files: { '.gitattributes': '*.sh text\n' },
        attributes: 'change',
    },
] as const)('the init plan keeps the project TypeScript pin and lists $name', async ({ files, attributes }) => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module","devDependencies":{"typescript":"^5.0.0"}}\n',
        ...files,
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'typescript']);
    const pin = { path: 'package.json', note: expect.stringContaining(cliPackage.version) as string };
    expect(plan.change).toStrictEqual(attributes === 'change' ? [ATTRIBUTES_ROW, pin] : [pin]);
    expect(plan.write.filter(({ path }) => path === ATTRIBUTES_ROW.path)).toStrictEqual(
        attributes === 'write' ? [ATTRIBUTES_ROW] : [],
    );
});

test('the init plan asks for git add --renormalize when the index holds CRLF files', async () => {
    await using sandbox = await createGitSandbox({ 'notes.txt': 'one\r\ntwo\r\n', 'kept.txt': 'kept\n' });
    const { plan } = await planSandboxInit(sandbox.path);
    expect(plan.write.find(({ path }) => path === ATTRIBUTES_ROW.path)).toStrictEqual({
        path: ATTRIBUTES_ROW.path,
        note: expect.stringContaining('git add --renormalize .') as string,
    });
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await createGitSandbox({ 'bitbucket-pipelines.yml': '{}\n' });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'gspot']);
    expect(plan.keep.map((file) => file.path)).toStrictEqual(['bitbucket-pipelines.yml']);
});

test('the init plan lists each submodule once and reads none of it', async () => {
    await using sandbox = await testdir();
    await using outside = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    const commitId = commitAll(sandbox.path);
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(sandbox.path, 'external project'), 'dir');
    // planSandboxInit commits every file, and that commit replaces the submodule entry of the index with the link.
    const { plan } = await planInit(sandbox.path, { configurations: ['gspot'] });
    expect(plan.keep).toStrictEqual([{ path: 'external project', note: UNREAD_SUBMODULE_MESSAGE }]);
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
});

test('init plans no scope for an old lint folder, and --level all replaces the config files of that level', async () => {
    await using sandbox = await testdir(QUALITY_PACKAGE_FILES);
    const { plan, settingsText } = await planSandboxInit(sandbox.path, ['--level', 'all']);
    expect(plan.level).toBe('all');
    expect(parseSettings(settingsText, sandbox.path)).toMatchObject({ level: 'all', scopes: {} });
    expect(plan.lintFolders.map(({ path }) => path)).toStrictEqual(['quality/']);
    expect(plan.deleted).toStrictEqual([
        { path: '.commitlintrc.json', note: expect.stringContaining('commitlint') as string },
    ]);
});

test('the init plan lists the lint commands and the format scripts of other formatters', async () => {
    const manifest = '{\n  "private": true,\n  "scripts": { "lint": "eslint .", "format": "oxfmt ." }\n}\n';
    await using sandbox = await createGitSandbox({ 'package.json': manifest, 'main.js': 'export const value = 1;\n' });
    const { plan } = await planSandboxInit(sandbox.path);
    expect(plan.lintCommands.map(({ command }) => command)).toStrictEqual(['eslint .', 'oxfmt .']);
});

test('init names the crlf setting of your .editorconfig as dropped', async () => {
    await using sandbox = await createGitSandbox({ '.editorconfig': 'root = true\n\n[*]\nend_of_line = crlf\n' });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(plan.write.find(({ path }) => path === '.editorconfig')?.note).toContain(DROPPED_LINE_SETTINGS_NOTE);
});

test('init lists your .editorconfig under write and not under delete when the generated one replaces it', async () => {
    const authored = 'root = true\n[*]\nindent_style = space\nindent_size = 2\n';
    await using sandbox = await createGitSandbox({ '.editorconfig': authored });
    const { plan } = await applySandboxInit(sandbox.path, ['--configurations', 'format']);
    expect(plan.deleted.map(({ path }) => path)).not.toContain('.editorconfig');
    expect(plan.write.filter(({ path }) => path === '.editorconfig')).toStrictEqual([
        { path: '.editorconfig', note: expect.stringContaining('git show HEAD:.editorconfig') as string },
    ]);
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).not.toBe(authored);
});

test('init pins gspot in mise.toml for a package.json with no dependency and no script file', async () => {
    const manifest = '{"name":"scripts","bin":{"run":"run.sh"}}\n';
    await using sandbox = await testdir({ 'package.json': manifest, 'run.sh': '#!/bin/sh\nexit 0\n' });
    const { plan } = await planSandboxInit(sandbox.path);
    expect(plan.change).toContainEqual({
        path: 'mise.toml',
        note: expect.stringContaining(cliPackage.version) as string,
    });
    expect(plan.change.map(({ path }) => path)).not.toContain('package.json');
});

test('init distinguishes named, required and always selected configurations', async () => {
    await using sandbox = await createGitSandbox({
        'source.ts': 'export {};\n',
        'tsconfig.json': '{}\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'typescript']);
    expect(plan.configurations.find(({ configuration }) => configuration === 'typescript')?.origin).toBe('named');
    expect(plan.configurations.find(({ configuration }) => configuration === 'javascript')?.origin).toBe('required');
    expect(plan.configurations.find(({ configuration }) => configuration === 'format')?.origin).toBe('always');
});

test('init identifies a configuration detected from a file', async () => {
    await using sandbox = await createGitSandbox({ Dockerfile: 'FROM node:24\n' });
    const { plan } = await planSandboxInit(sandbox.path);
    expect(plan.configurations.find(({ configuration }) => configuration === 'docker')?.origin).toBe('detected');
});

test('the init plan prints each scope, folds the always-selected configurations, and shows gspot.toml', async () => {
    await using sandbox = await createGitSandbox({ ...WORKSPACE_PYTHON_FILES, 'AGENTS.md': '# Agents\n' });
    const { plan, settingsText } = await planSandboxInit(sandbox.path);
    const printed = formatInitPlan(plan, settingsText);
    expect(printed).toMatch(/^ {2}python +detected +service +\d+ checks \(\d+ off at basic\)$/mu);
    expect(printed).toMatch(/^ {2}\d+ always-selected configurations: \d+ checks \(\d+ off at basic\)$/mu);
    expect(printed).not.toMatch(/^ {2}format /mu);
    expect(printed).toContain('gspot.toml\n  # Change these settings');
    expect(printed).toMatch(/^ {2}\.gspot\/package\.json +\d+ pinned npm tools; lockfile written by gspot install$/mu);
    expect(printed).toMatch(/^change\n(?: {2}.+\n)*? {2}AGENTS\.md +adds the gspot block$/mu);
});
