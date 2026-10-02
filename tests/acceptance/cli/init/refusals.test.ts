// Planted repositories: what init refuses before it writes.
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { treeContents } from '#tests/harness/planted/preservation.ts';

const INIT_REFUSALS_QUIET = ['--no-runner', '--no-ci', '--no-guides', '--no-install'];

test(
    'init refusals > a nonterminal preview names its accepted configuration list and keeps JSON output parseable',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        const flags = ['init', '--dry-run', '--no-hooks', ...INIT_REFUSALS_QUIET];
        const result = await spawnGspot(sandbox.path, flags);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout + result.stderr).toMatch(/Selected: [^\n]*bash[^\n]*Change with --kits <ids>\./u);
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const json = await spawnGspot(sandbox.path, [...flags, '--json']);
        expect(json.code, json.stdout + json.stderr).toBe(0);
        expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
        expect(json.stdout + json.stderr).not.toContain('Selected:');
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refusals > a choice flag outside its list exits 2 and names the allowed values',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        const result = await spawnGspot(sandbox.path, ['init', '--yes', '--ci', 'foo']);
        expect(result.code).toBe(2);
        expect(result.stderr).toContain('Allowed choices are github, gitlab');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const invalidStage = await spawnGspot(sandbox.path, ['check', '--stage', 'later']);
        expect(invalidStage.code).toBe(2);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refusals > an unknown kit names the near match',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        const unknown = await spawnGspot(sandbox.path, ['init', '--yes', '--kits', 'bassh', ...INIT_REFUSALS_QUIET]);
        expect(unknown.code).toBe(2);
        expect(unknown.stderr).toContain('Did you mean `bash`');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refusals > uncommitted changes stop init until they are committed',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
        const refused = await spawnGspot(sandbox.path, ['init', '--yes', '--kits', 'bash', ...INIT_REFUSALS_QUIET]);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toContain('Commit or stash them');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        commitAll(sandbox.path);
        const allowed = await spawnGspot(sandbox.path, ['init', '--yes', '--kits', 'bash', ...INIT_REFUSALS_QUIET], {
            PATH: `${join(import.meta.dir, '../../../../node_modules/.bin')}${delimiter}${toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos', 'ec'])}`,
        });
        expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refusals > a named kit brings its recommended kits',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
        await spawnGspot(sandbox.path, ['init', '--yes', '--kits', 'bash', ...INIT_REFUSALS_QUIET], environment);
        const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        expect(policy).toContain('"formatting"');
        expect(policy).toContain('"naming"');
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refusals > one --scope flag writes both scopes with their configurations',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'tools/a.sh': script, 'jobs/b.sh': script });
        commitAll(sandbox.path);
        const argv = ['init', '--yes', '--no-hooks', '--scope', 'tools=bash', 'jobs=bash', ...INIT_REFUSALS_QUIET];
        const init = await spawnGspot(sandbox.path, argv, { PATH: toolsPath(['shellcheck', 'shfmt', 'typos', 'ec']) });
        expect(init.code, init.stdout + init.stderr).toBe(0);
        const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        const parsed = parsePolicyText(policy, 'gspot.toml');
        expect(parsed.scopes.find((scope) => scope.path === 'tools')?.kits).toContain('bash');
        expect(parsed.scopes.find((scope) => scope.path === 'jobs')?.kits).toContain('bash');
    },
    PLANTED_TIMEOUT_MS,
);

test('initialization flags control integrations, and the plan names the formatter file init deletes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const command = [
        'init',
        '--yes',
        '--kits',
        'javascript',
        '--no-hooks',
        '--no-ci',
        '--no-runner',
        '--no-guides',
        '--no-install',
        '--dry-run',
        '--json',
    ];
    const preview = await spawnGspot(sandbox.path, command);
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
])('init reports invalid %s content %s before writing', async (path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: content, 'source.ts': 'export {};\n' });
    const before = treeContents(sandbox.path);
    const result = await spawnGspot(sandbox.path, ['init', '--yes', '--no-hooks', ...INIT_REFUSALS_QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain(path);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
});
