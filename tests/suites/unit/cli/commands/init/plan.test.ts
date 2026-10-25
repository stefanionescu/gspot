import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { parseSettings } from '#cli/settings/read.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';

import {
    GIT_PLAN_CASES,
    SHARED_SETUP_FILES,
    EDITORCONFIG_WRITE,
    QUALITY_PACKAGE_FILES,
    EXACT_DEPENDENCY_CHANGES,
} from '#tests/config/commands/init/plan.ts';

test('init names pinned dependencies without proposing to delete the package manifest', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example","private":true,"type":"module","devDependencies":{"typescript":"^5.0.0"}}\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--configurations',
        'typescript',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.change).toStrictEqual([...EXACT_DEPENDENCY_CHANGES]);
    expect(plan.delete).toStrictEqual([]);
    expect(plan.noLongerRuns).toStrictEqual([]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the init plan keeps existing CI jobs apart from tool settings that the generated config files replace', async () => {
    await using sandbox = await testdir(SHARED_SETUP_FILES);

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...buildInitArguments(['sql']), '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const kept = preview.stdout.split('left in place\n', 2)[1]?.split('\n\n', 1)[0];
    expect(kept).toBe(
        '  setup.cfg                sqlfluff settings stay here, and the generated sqlfluff config file takes over. Delete the section; the generated config file replaces it.\n  .gitlab-ci.yml: quality  existing lint job kept. gspot adds no second CI job.',
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await createGitSandbox({ 'bitbucket-pipelines.yml': '{}\n' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--no-configurations', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained.map((file) => file.path)).toStrictEqual(['bitbucket-pipelines.yml']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the init plan groups test runners and infrastructure under their own labels', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"example","private":true,"dependencies":{"jest":"30.2.0"}}',
        Dockerfile: 'FROM node:24\n',
    });

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([]), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n').filter((line) => /^(?:testing|infrastructure|tools)\s/u.test(line))).toStrictEqual(
        ['testing              jest  jest in package.json', 'infrastructure       docker  Dockerfile'],
    );
});

test('the init plan lists each submodule once and reads none of it', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    runGitStep(outside.path, ['init', '--quiet']);
    await createFileTree(sandbox.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(sandbox.path);
    const commitId = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(sandbox.path, 'external project'), 'dir');
    const result = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--no-configurations', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; init does not read it' }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test('init plans no scope for an old lint folder, and --level all replaces the config files of that level', async () => {
    await using sandbox = await testdir(QUALITY_PACKAGE_FILES);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments([], { json: true }),
        '--dry-run',
        '--level',
        'all',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settings } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    expect(plan.level).toBe('all');
    expect(parseSettings(settings, sandbox.path)).toMatchObject({ level: 'all', scopes: {} });
    expect(plan.noLongerRuns.map(({ path }) => path)).toStrictEqual(['quality/']);
    expect(plan.delete).toStrictEqual([
        { path: '.commitlintrc.json', note: 'replaced by the generated commitlint config file' },
    ]);
});

test('init names disable comments for rules that the new setup does not load', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"app","private":true,"type":"module"}\n',
        'src/old.js':
            '// eslint-disable-next-line local-rules/no-legacy -- the old setup had this rule\nexport const value = 1;\n/* eslint-disable no-console, unicorn/no-null */\n',
    });
    const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained).toStrictEqual([
        { path: 'src/old.js', note: 'local-rules/no-legacy: gspot does not load these rules; delete the comments' },
    ]);
});

test('init lists your .editorconfig under write and not under delete when the generated one replaces it', async () => {
    const authored = 'root = true\n[*]\nindent_style = space\nindent_size = 2\n';
    await using sandbox = await createGitSandbox({ '.editorconfig': authored });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const commandArguments = buildInitArguments(['format'], { json: true });

    const preview = await runGspot(sandbox.path, [...commandArguments, '--dry-run']);

    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { plan } = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.delete.map(({ path }) => path)).not.toContain('.editorconfig');
    expect(plan.write.filter(({ path }) => path === '.editorconfig')).toStrictEqual([...EDITORCONFIG_WRITE]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).not.toBe(authored);
    expect(runGitStep(sandbox.path, ['show', 'HEAD:.editorconfig'])).toBe(authored.trimEnd());
});
test.each([...GIT_PLAN_CASES])('init in $name plans only the Git changes that apply', async ({ hasGit, changes }) => {
    await using sandbox = await testdir({ 'control.txt': 'preserve this source\n' });

    if (hasGit) commitAll(sandbox.path);
    const commandArguments = [...buildInitArguments([], { json: true }), '--no-configurations'];
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...commandArguments, '--dry-run']);
    if (!hasGit) {
        expect(preview.code, preview.stdout + preview.stderr).toBe(2);
        expect(JSON.parse(preview.stdout)).toStrictEqual({
            error: 'git',
            message: 'gspot needs a Git repository. Run git init, then gspot init.',
        });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        return;
    }
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    expect(report.plan.change.map((file) => file.path)).toStrictEqual([...changes]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gitignore'))).toBe(hasGit);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(hasGit);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe('preserve this source\n');
});

test.each([false, true])(
    'init distinguishes existing CI from the provider of the planned workflow (GitHub origin: %p)',
    async (github) => {
        await using sandbox = await testdir({ 'package.json': '{"private":true}\n' });
        runGitStep(sandbox.path, ['init', '--quiet']);
        if (github) runGitStep(sandbox.path, ['remote', 'add', 'origin', 'https://github.com/example/project.git']);
        const result = await runGspot(sandbox.path, ['init', '--dry-run']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('existing hooks');
        expect(result.stdout).toContain('existing ci');
        const note = 'none: no GitHub or GitLab remote or CI file. Run gspot set ci.enabled true later.';
        if (github) expect(result.stdout).not.toContain(note);
        else expect(result.stdout).toContain(note);
    },
);

test('init lists at most five unchecked paths of an unsupported extension', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}\n',
        infra: Object.fromEntries(
            Array.from({ length: 6 }, (_, index) => [`plan-${String(index)}.tf`, 'terraform {}\n']),
        ),
        'README.md': '# Project\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const rows = result.stdout.split('\n').filter((line) => line.startsWith('not checked'));
    expect(rows).toHaveLength(5);
    for (const [index, row] of rows.entries())
        expect(row).toContain(`infra/plan-${String(index)}.tf (no configuration reads .tf files)`);
    expect(result.stdout).not.toContain('not checked          README.md');
});
