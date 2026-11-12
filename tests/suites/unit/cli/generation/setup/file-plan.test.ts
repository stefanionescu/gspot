import { existsSync } from 'node:fs';
import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { ATTRIBUTES_ROW, DROPPED_LINE_SETTINGS_NOTE, UNREAD_SUBMODULE_MESSAGE } from '#cli/config/generation/setup.ts';
import { readSettings } from '#cli/settings/read.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { initOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module","devDependencies":{"typescript":"^5.0.0"}}\n',
        ...files,
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    const pin = { path: 'package.json', note: expect.stringContaining(cliPackage.version) as string };
    expect(plan.change).toStrictEqual(attributes === 'change' ? [ATTRIBUTES_ROW, pin] : [pin]);
    expect(plan.write.filter(({ path }) => path === ATTRIBUTES_ROW.path)).toStrictEqual(
        attributes === 'write' ? [ATTRIBUTES_ROW] : [],
    );
    expect(plan.deleted).toStrictEqual([]);
    expect(plan.lintFolders).toStrictEqual([]);
});

test('the init plan asks for git add --renormalize when the index holds CRLF files', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'notes.txt': 'one\r\ntwo\r\n', 'kept.txt': 'kept\n' });
    runGitStep(sandbox.path, ['add', '.']);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.write.find(({ path }) => path === ATTRIBUTES_ROW.path)).toStrictEqual({
        path: ATTRIBUTES_ROW.path,
        note: expect.stringContaining('git add --renormalize .') as string,
    });
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'bitbucket-pipelines.yml': '{}\n' });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'gspot', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.keep.map((file) => file.path)).toStrictEqual(['bitbucket-pipelines.yml']);
});

test('the init plan lists each submodule once and reads none of it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir();
    await using outside = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(sandbox.path);
    const commitId = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(sandbox.path, 'external project'), 'dir');
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'gspot', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        plan: { keep: [{ path: 'external project', note: UNREAD_SUBMODULE_MESSAGE }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
});

test('init plans no scope for an old lint folder, and --level all replaces the config files of that level', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir(QUALITY_PACKAGE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json', '--level', 'all']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settingsText } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.level).toBe('all');
    expect(readSettings(settingsText, sandbox.path)).toMatchObject({ level: 'all', scopes: {} });
    expect(plan.lintFolders.map(({ path }) => path)).toStrictEqual(['quality/']);
    expect(plan.deleted).toStrictEqual([
        { path: '.commitlintrc.json', note: expect.stringContaining('commitlint') as string },
    ]);
});

test('the init plan names the line of each lint command and leaves the file alone', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const manifest = '{\n  "private": true,\n  "scripts": { "lint": "eslint ." }\n}\n';
    await using sandbox = await createGitSandbox({ 'package.json': manifest, 'main.js': 'export const value = 1;\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.lintCommands).toStrictEqual([
        {
            file: 'package.json',
            line: 3,
            source: 'script',
            command: 'eslint .',
            tool: 'eslint',
            fix: expect.any(String) as string,
        },
    ]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toContain('"lint": "eslint ."');
});

test('init names the crlf setting of your .editorconfig as dropped', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ '.editorconfig': 'root = true\n\n[*]\nend_of_line = crlf\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.write.find(({ path }) => path === '.editorconfig')?.note).toContain(DROPPED_LINE_SETTINGS_NOTE);
});

test('init lists your .editorconfig under write and not under delete when the generated one replaces it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const authored = 'root = true\n[*]\nindent_style = space\nindent_size = 2\n';
    await using sandbox = await createGitSandbox({ '.editorconfig': authored });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(initialized.stdout));
    expect(plan.deleted.map(({ path }) => path)).not.toContain('.editorconfig');
    expect(plan.write.filter(({ path }) => path === '.editorconfig')).toStrictEqual([
        { path: '.editorconfig', note: expect.stringContaining('git show HEAD:.editorconfig') as string },
    ]);
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).not.toBe(authored);
});

test('init pins gspot in mise.toml for a package.json with no dependency and no script file', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const manifest = '{"name":"scripts","bin":{"run":"run.sh"}}\n';
    await using sandbox = await testdir({ 'package.json': manifest, 'run.sh': '#!/bin/sh\nexit 0\n' });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'mise.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(manifest);
});

test('init lists at most five unchecked paths of an unsupported extension', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}\n',
        infra: Object.fromEntries(
            Array.from({ length: 6 }, (_, index) => [`plan-${String(index)}.tf`, 'terraform {}\n']),
        ),
        'README.md': '# Project\n',
    });
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const rows = result.stdout.split('\n').filter((line) => line.startsWith('not checked'));
    expect(rows).toHaveLength(5);
    for (const [index, row] of rows.entries())
        expect(row).toContain(`infra/plan-${String(index)}.tf (no configuration reads .tf files)`);
    expect(result.stdout).not.toContain('not checked          README.md');
});

test('init distinguishes named, required and always selected configurations', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'source.ts': 'export {};\n',
        'tsconfig.json': '{}\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.configurations.find(({ configuration }) => configuration === 'typescript')?.origin).toBe('named');
    expect(plan.configurations.find(({ configuration }) => configuration === 'javascript')?.origin).toBe('required');
    expect(plan.configurations.find(({ configuration }) => configuration === 'format')?.origin).toBe('always');
});

test('init identifies a configuration detected from a file', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ Dockerfile: 'FROM node:24\n' });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
    expect(plan.configurations.find(({ configuration }) => configuration === 'docker')?.origin).toBe('detected');
});

test('the init plan prints each scope, folds the always-selected configurations, and shows gspot.toml', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ ...WORKSPACE_PYTHON_FILES, 'AGENTS.md': '# Agents\n' });
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^ {2}python +detected +service +\d+ checks \(\d+ off at basic\)$/mu);
    expect(result.stdout).toMatch(/^ {2}\d+ always-selected configurations: \d+ checks \(\d+ off at basic\)$/mu);
    expect(result.stdout).not.toMatch(/^ {2}format /mu);
    expect(result.stdout).toContain('gspot.toml\n  # Change these settings');
    expect(result.stdout).toMatch(
        /^ {2}\.gspot\/package\.json +\d+ pinned npm tools; lockfile written by gspot install$/mu,
    );
    expect(result.stdout).toMatch(/^change\n(?: {2}.+\n)*? {2}AGENTS\.md +adds the gspot block$/mu);
});
