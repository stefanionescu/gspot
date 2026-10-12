import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { symlink, readFile } from 'node:fs/promises';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { buildInitOptions, buildInitArguments } from '#tests/setup/init.ts';

test('the init plan keeps existing CI jobs apart from tool settings that the generated tool files replace', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    expect(preview.stdout).not.toContain('kept active');
    expect(preview.stdout).not.toContain('left in place, no longer read');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const empty = await runGspot(sandbox.path, [...buildInitArguments([]), '--configurations', 'none', '--dry-run']);
    expect(empty.code, empty.stdout + empty.stderr).toBe(0);
    expect(empty.stdout).toMatch(/^ {2}security\s+required\s/mu);
    expect(empty.stdout).not.toMatch(/^ {2}sql\s+/mu);
    expect(empty.stdout).not.toContain('the rules install alone');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init leaves an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'bitbucket-pipelines.yml': '{}\n' });
    const before = await readTree(sandbox.path);
    const result = await initCommand(buildInitOptions(sandbox.path, { isDryRun: true, configurations: [] }));
    expect(result.exitCode, result.text).toBe(0);
    const { plan } = result.json as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained.map((entry) => entry.path)).toStrictEqual(['bitbucket-pipelines.yml']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the init plan groups test runners and infrastructure under their own labels', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(directory.path);
    const commitId = gitOutput(directory.path, ['rev-parse', 'HEAD']);
    gitOutput(directory.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(directory.path, 'external project'), 'dir');
    const result = await initCommand(
        buildInitOptions(directory.path, {
            isDryRun: true,
            configurations: [],
        }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; contents are not read' }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(await pathExists(join(directory.path, 'gspot.toml'))).toBe(false);
});
