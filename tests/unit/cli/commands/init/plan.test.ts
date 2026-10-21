import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { symlink, readFile } from 'node:fs/promises';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';

test('init names pinned dependencies without proposing to delete the package manifest', async () => {
    await using sandbox = await testdir({
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
    expect(plan.change).toContainEqual({
        path: 'package.json',
        note: 'typescript is now pinned in .gspot/package.json; remove it from devDependencies if nothing else uses it',
    });
    expect([...plan.delete, ...plan.noLongerRuns].map(({ path }) => path)).not.toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the init plan keeps existing CI jobs apart from tool settings that the generated tool files replace', async () => {
    await using sandbox = await testdir({
        'setup.cfg': `[flake8]
ignore = E501
[sqlfluff]
exclude_rules = LT01
`,
        '.gitlab-ci.yml': 'quality:\n  script: npm run lint\n',
        'query.sql': 'SELECT 1;\n',
    });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...buildInitArguments(['sql']), '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const retained = preview.stdout.split('left in place\n', 2)[1]?.split('\n\n', 1)[0];
    expect(retained).toContain('setup.cfg');
    expect(retained).toContain('generated sqlfluff tool file takes over');
    expect(retained).toContain('.gitlab-ci.yml: quality');
    expect(retained).toContain('existing lint job kept. gspot adds no second CI job.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await testdir({ 'bitbucket-pipelines.yml': '{}\n' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--no-configurations', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained.map((entry) => entry.path)).toStrictEqual(['bitbucket-pipelines.yml']);
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
    expect(result.stdout).toMatch(/^testing\s+jest\b/mu);
    expect(result.stdout).toMatch(/^infrastructure\s+docker\b/mu);
    expect(result.stdout).not.toMatch(/^tools\s/mu);
});

test('the init plan lists each submodule once and reads none of it', async () => {
    await using folder = await testdir();
    await using outside = await testdir();
    await createFileTree(folder.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(folder.path);
    const commitId = readGitOutput(folder.path, ['rev-parse', 'HEAD']);
    readGitOutput(folder.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(folder.path, 'external project'), 'dir');
    const result = await runGspot(folder.path, ['init', '--yes', '--dry-run', '--no-configurations', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; contents are not read' }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(await isOnDisk(join(folder.path, 'gspot.toml'))).toBe(false);
});

test('init plans no scope for an old lint folder, and --level all replaces the tool files of that level', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"shop","private":true,"type":"module","dependencies":{"react":"19.0.0"}}\n',
        'src/app.tsx': 'export const App = () => null;\n',
        'quality/package.json': '{"name":"shop-quality","private":true,"dependencies":{"ts-morph":"26.0.0"}}\n',
        'quality/check.ts': 'export const value = 1;\n',
        '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments([], { json: true }),
        '--dry-run',
        '--level',
        'all',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settings } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    expect(plan.level).toBe('all');
    expect(settings).toContain('level = "all"');
    expect(settings).not.toContain('path = "quality"');
    expect(plan.noLongerRuns.map(({ path }) => path)).toStrictEqual(['quality/']);
    expect(plan.delete.map(({ path }) => path)).toContain('.commitlintrc.json');
});

test('init names disable comments for rules that the new setup does not load', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"app","private":true,"type":"module"}\n',
        'src/old.js':
            '// eslint-disable-next-line local-rules/no-legacy -- the old setup had this rule\nexport const value = 1;\n/* eslint-disable no-console, unicorn/no-null */\n',
    });
    const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained).toContainEqual({
        path: 'src/old.js',
        note: 'local-rules/no-legacy: gspot does not load these rules; delete the comments',
    });
});

test('init lists your .editorconfig under write and not under delete when the generated one replaces it', async () => {
    const authored = 'root = true\n[*]\nindent_style = space\nindent_size = 2\n';
    await using sandbox = await testdir({ '.editorconfig': authored });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const commandArguments = buildInitArguments(['format'], { json: true });

    const preview = await runGspot(sandbox.path, [...commandArguments, '--dry-run']);

    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { plan } = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.delete.map(({ path }) => path)).not.toContain('.editorconfig');
    expect(plan.write.filter(({ path }) => path === '.editorconfig')).toStrictEqual([
        {
            path: '.editorconfig',
            note: 'replaces your file; read the old one with git show HEAD:.editorconfig',
        },
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).not.toBe(authored);
    expect(readGitOutput(sandbox.path, ['show', 'HEAD:.editorconfig'])).toBe(authored.trimEnd());
});
