// What init refuses before it writes, and what a preview proposes without writing.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { QUIET, PREVIEW, GIT_PLAN_CASES } from '#tests/config/cli/commands/init/refusals.ts';

test('a preview writes nothing and prints parseable JSON', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const json = await runGspot(sandbox.path, PREVIEW);
    expect(json.code, json.stdout + json.stderr).toBe(0);
    expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test.each([
    ['a choice outside its list', ['init', '--yes', '--ci', 'foo']],
    ['an unknown configuration', ['init', '--yes', '--configurations', 'bassh', ...QUIET]],
    ['an unknown hook', ['check', '--hook', 'later']],
])('%s exits 2 and writes nothing', async (_name, argv) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const result = await runGspot(sandbox.path, argv);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('uncommitted changes stop init until they are committed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
    const argv = ['init', '--yes', '--configurations', 'none', '--no-hooks', ...QUIET];
    const before = readTree(sandbox.path);
    const diagnostic =
        'The working tree has 1 uncommitted change(s). Commit or stash them before gspot init: Git then keeps every file init replaces, and you review its changes separately.';
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${diagnostic}\n`);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'policy', message: diagnostic });
    expect(readTree(sandbox.path)).toStrictEqual(before);
    commitAll(sandbox.path);
    const allowed = await runGspot(sandbox.path, argv);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
});

test('failed Git status stops initialization with a selection error before writing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const run = processes.runBlocking;
    using boundary = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'git' || command[1] !== 'status' || command[2] !== '--porcelain')
            return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'status unavailable\n' };
    });
    const argv = ['init', '--yes', '--configurations', 'none', ...QUIET];
    const human = await runGspot(sandbox.path, argv);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Git status failed (exit 7): status unavailable\n');
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'selection',
        message: 'Git status failed (exit 7): status unavailable',
    });
    expect(boundary).toHaveBeenCalledWith(
        ['git', 'status', '--porcelain'],
        expect.objectContaining({ cwd: sandbox.path }),
    );
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('a named configuration brings its recommended configurations, and one --scope-configurations flag proposes both scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'tools/a.sh': CLEAN_BASH_SCRIPT, 'jobs/b.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const named = await runGspot(sandbox.path, [...PREVIEW, '--configurations', 'bash']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const { plan } = JSON.parse(named.stdout) as Required<Pick<InitJson, 'plan'>>;
    const configurations = plan.configurations.map(({ configuration }) => configuration);
    for (const configuration of ['bash', 'format', 'naming']) expect(configurations).toContain(configuration);
    const twoScopes = await runGspot(sandbox.path, [...PREVIEW, '--scope-configurations', 'tools=bash', 'jobs=bash']);
    expect(twoScopes.code, twoScopes.stdout + twoScopes.stderr).toBe(0);
    const parsed = parseStrictPolicy((JSON.parse(twoScopes.stdout) as Required<Pick<InitJson, 'policy'>>).policy);
    expect(parsed.scopes.find((scope) => scope.path === 'tools')?.configurations).toContain('bash');
    expect(parsed.scopes.find((scope) => scope.path === 'jobs')?.configurations).toContain('bash');
});

test('initialization flags control integrations, and the plan names the formatter file init deletes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const preview = await runGspot(sandbox.path, [...PREVIEW, '--configurations', 'javascript']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const policy = parseStrictPolicy(plan.policy);
    expect(policy).not.toHaveProperty('hooks');
    expect(policy).not.toHaveProperty('ci');
    expect(policy).not.toHaveProperty('runner');
    expect(policy.format).toStrictEqual({});
    expect(plan.plan.remove).toContainEqual({
        path: '.prettierrc.json',
        note: 'replaced by the generated prettier configuration',
    });
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(await Bun.file(join(sandbox.path, '.prettierrc.json')).text()).toBe('{"semi":false,"tabWidth":8}\n');
});

test.each([
    ['package.json', '{'],
    ['package.json', '{"dependencies":{"typescript":7}}'],
    ['package.json', '{"scripts":{"lint":false}}'],
    ['package.json', '{"workspaces":[7]}'],
    ['pyproject.toml', '[project'],
    ['pyproject.toml', '[project]\ndependencies = [7]\n'],
])('init refuses invalid %s content %s before writing', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const before = readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--no-hooks', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain(path);
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["bash"]\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--json', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'already-initialized',
        message: textContaining('gspot doctor'),
    });
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('init from a template address that answers 404 exits 2 and writes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    using fetched = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    const result = await runGspot(sandbox.path, ['init', '--yes', '--from', 'github:acme/missing', ...QUIET]);
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('answered 404');
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('JSON initialization without --yes reports the argument before reading invalid project input', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    const before = readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'prompt', message: textContaining('--yes') });
    expect(result.stdout).not.toContain('package.json');
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test.each(GIT_PLAN_CASES)('initialization in $name previews only applicable Git changes', async ({ hasGit }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    if (hasGit) commitAll(sandbox.path);
    const argv = ['init', '--yes', '--configurations', 'none', ...QUIET, '--json'];
    const before = readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...argv, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'policy'>>;
    const changes = report.plan.change.map((entry) => entry.path);
    expect(changes.includes('.gitignore')).toBe(hasGit);
    expect(changes.includes('.gspot/hooks')).toBe(hasGit);
    expect(changes).toContain('.gitattributes');
    expect(parseStrictPolicy(report.policy).hooks).toBeDefined();
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, '.gitignore'))).toBe(hasGit);
    expect(existsSync(join(sandbox.path, '.gitattributes'))).toBe(true);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});

test('initialization without a terminal names --yes once and writes only after explicit acceptance', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    const argv = ['init', '--configurations', 'none', '--no-hooks', ...QUIET];
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('Continue? There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...argv, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});
