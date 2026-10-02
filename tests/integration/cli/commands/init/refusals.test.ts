// What init refuses before it writes, and what a preview proposes without writing.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { treeContents } from '#tests/harness/planted/preservation.ts';

const QUIET = ['--no-runner', '--no-ci', '--no-guides', '--no-install'];
const PREVIEW = ['init', '--yes', '--no-hooks', ...QUIET, '--dry-run', '--json'];

test('a preview writes nothing and prints parseable JSON', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': script });
    commitAll(sandbox.path);
    const json = await runGspot(sandbox.path, PREVIEW);
    expect(json.code, json.stdout + json.stderr).toBe(0);
    expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test.each([
    ['a choice outside its list', ['init', '--yes', '--ci', 'foo']],
    ['an unknown kit', ['init', '--yes', '--kits', 'bassh', ...QUIET]],
    ['an unknown stage', ['check', '--stage', 'later']],
])('%s exits 2 and writes nothing', async (_name, argv) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': script });
    commitAll(sandbox.path);
    const before = treeContents(sandbox.path);
    const result = await runGspot(sandbox.path, argv);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
});

test('uncommitted changes stop init until they are committed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': script });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
    const argv = ['init', '--yes', '--kits', 'none', '--no-hooks', ...QUIET];
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    commitAll(sandbox.path);
    const allowed = await runGspot(sandbox.path, argv);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
});

test('a named kit brings its recommended kits, and one --scope flag proposes both scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'tools/a.sh': script, 'jobs/b.sh': script });
    commitAll(sandbox.path);
    const named = await runGspot(sandbox.path, [...PREVIEW, '--kits', 'bash']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const { plan } = JSON.parse(named.stdout) as { plan: { kits: { kit: string }[] } };
    const kits = plan.kits.map(({ kit }) => kit);
    for (const kit of ['bash', 'formatting', 'naming']) expect(kits).toContain(kit);
    const twoScopes = await runGspot(sandbox.path, [...PREVIEW, '--scope', 'tools=bash', 'jobs=bash']);
    expect(twoScopes.code, twoScopes.stdout + twoScopes.stderr).toBe(0);
    const parsed = parsePolicyText((JSON.parse(twoScopes.stdout) as { policy: string }).policy, 'gspot.toml');
    expect(parsed.scopes.find((scope) => scope.path === 'tools')?.kits).toContain('bash');
    expect(parsed.scopes.find((scope) => scope.path === 'jobs')?.kits).toContain('bash');
});

test('initialization flags control integrations, and the plan names the formatter file init deletes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const preview = await runGspot(sandbox.path, [...PREVIEW, '--kits', 'javascript']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = JSON.parse(preview.stdout) as { policy: string; plan: { remove: { path: string; note: string }[] } };
    const policy = parsePolicyText(plan.policy, 'gspot.toml');
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
    ['pyproject.toml', '[tool.uv.workspace]\nmembers = [7]\n'],
])('init refuses invalid %s content %s before writing', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const before = treeContents(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--no-hooks', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
});
