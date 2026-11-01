import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { symlink, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { WORKSPACE_PYTHON_FILES } from '#tests/config/commands/init/settings.ts';

import {
    GIT_PLAN_CASES,
    PRESERVE_SOURCE,
    EDITORCONFIG_WRITE,
    ATTRIBUTES_PLAN_ROW,
    QUALITY_PACKAGE_FILES,
} from '#tests/config/commands/init/plan.ts';

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
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.change).toStrictEqual(attributes === 'change' ? [ATTRIBUTES_PLAN_ROW] : []);
    expect(plan.write.filter(({ path }) => path === ATTRIBUTES_PLAN_ROW.path)).toStrictEqual(
        attributes === 'write' ? [ATTRIBUTES_PLAN_ROW] : [],
    );
    expect(plan.delete).toStrictEqual([]);
    expect(plan.lintFolders).toStrictEqual([]);
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await createGitSandbox({ 'bitbucket-pipelines.yml': '{}\n' });
    const result = await runGspot(sandbox.path, ['init', '--no-configurations', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.keep.map((file) => file.path)).toStrictEqual(['bitbucket-pipelines.yml']);
});

test('the init plan lists each submodule once and reads none of it', async () => {
    await using sandbox = await testdir();
    await using outside = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(sandbox.path);
    const commitId = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(sandbox.path, 'external project'), 'dir');
    const result = await runGspot(sandbox.path, ['init', '--no-configurations', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        plan: { keep: [{ path: 'external project', note: 'submodule; init does not read it' }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
});

test('init plans no scope for an old lint folder, and --level all replaces the config files of that level', async () => {
    await using sandbox = await testdir(QUALITY_PACKAGE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json', '--level', 'all']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settingsText } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'settingsText'>>;
    expect(plan.level).toBe('all');
    expect(readSettings(settingsText, sandbox.path)).toMatchObject({ level: 'all', scopes: {} });
    expect(plan.lintFolders.map(({ path }) => path)).toStrictEqual(['quality/']);
    expect(plan.delete).toStrictEqual([
        { path: '.commitlintrc.json', note: 'replaced by the generated file for commitlint' },
    ]);
});

test('init names the crlf setting of your .editorconfig as dropped', async () => {
    await using sandbox = await createGitSandbox({ '.editorconfig': 'root = true\n\n[*]\nend_of_line = crlf\n' });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as InitJson;
    expect(plan.write.find(({ path }) => path === '.editorconfig')?.note).toContain(
        'gspot always writes lf and a final newline',
    );
});

test('init lists your .editorconfig under write and not under delete when the generated one replaces it', async () => {
    const authored = 'root = true\n[*]\nindent_style = space\nindent_size = 2\n';
    await using sandbox = await createGitSandbox({ '.editorconfig': authored });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--configurations', 'format', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const { plan } = JSON.parse(initialized.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.delete.map(({ path }) => path)).not.toContain('.editorconfig');
    expect(plan.write.filter(({ path }) => path === '.editorconfig')).toStrictEqual([...EDITORCONFIG_WRITE]);
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).not.toBe(authored);
    expect(runGitStep(sandbox.path, ['show', 'HEAD:.editorconfig'])).toBe(authored.trimEnd());
});

test.each([...GIT_PLAN_CASES])('init in $name plans only the Git changes that apply', async ({ changes }) => {
    await using sandbox = await testdir({ 'control.txt': PRESERVE_SOURCE });

    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--json', '--no-configurations']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stderr).toBe('');
    const report = JSON.parse(initialized.stdout) as Required<Pick<InitJson, 'plan' | 'settingsText'>>;
    expect(report.plan.change.map((file) => file.path)).toStrictEqual([...changes]);
    expect(await isOnDisk(join(sandbox.path, '.gitignore'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/.gitignore'))).toBe(true);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe(PRESERVE_SOURCE);
});

test('init leaves CI off with a GitHub origin and names the commands that turn it on', async () => {
    await using sandbox = await createGitSandbox({ 'package.json': '{"private":true}\n' });
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'https://github.com/example/project.git']);
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('existing hooks');
    expect(result.stdout).toContain('existing ci');
    expect(result.stdout).toContain(
        'CI is off. To turn it on, run gspot set ci.enabled true; for GitLab, also run gspot set ci.provider gitlab.',
    );
    const written = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(readSettings(written, sandbox.path).written).not.toHaveProperty('ci');
});

test('init lists at most five unchecked paths of an unsupported extension', async () => {
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
    await using sandbox = await createGitSandbox({
        'source.ts': 'export {};\n',
        'tsconfig.json': '{}\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'typescript', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.configurations.find(({ configuration }) => configuration === 'typescript')?.origin).toBe('named');
    expect(plan.configurations.find(({ configuration }) => configuration === 'javascript')?.origin).toBe('required');
    expect(plan.configurations.find(({ configuration }) => configuration === 'format')?.origin).toBe('always');
});

test('init identifies a configuration detected from a file', async () => {
    await using sandbox = await createGitSandbox({ Dockerfile: 'FROM node:24\n' });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.configurations.find(({ configuration }) => configuration === 'docker')?.origin).toBe('detected');
});

test('the init plan prints each scope, folds the always-selected configurations, and shows gspot.toml', async () => {
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
