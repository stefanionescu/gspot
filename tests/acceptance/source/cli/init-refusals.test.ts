import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
// Planted repositories: what init refuses before it writes.
import { parsePolicyText } from '#cli/policy/read.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { treeContents } from '#tests/support/cli/contents.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const QUIET = ['--no-runner', '--no-ci', '--no-rules', '--no-install'];

describe('init refusals', () => {
    test(
        'a nonterminal preview names its accepted configuration list and keeps JSON output parseable',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const flags = ['init', '--dry-run', '--no-hooks', '--format', 'shipped', ...QUIET];
            const result = await run(sandbox.path, flags);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            expect(result.stdout + result.stderr).toMatch(
                /Selected: [^\n]*bash[^\n]*Change with --configurations <ids>\./u,
            );
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            const json = await run(sandbox.path, [...flags, '--json']);
            expect(json.code, json.stdout + json.stderr).toBe(0);
            expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
            expect(json.stdout + json.stderr).not.toContain('Selected:');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a choice flag outside its list exits 2 and names the allowed values',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const result = await run(sandbox.path, ['init', '--yes', '--hooks', 'foo']);
            expect(result.code).toBe(2);
            expect(result.stderr).toContain('Allowed choices are gspot, lefthook, husky');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            const invalidStage = await run(sandbox.path, ['check', '--stage', 'later']);
            expect(invalidStage.code).toBe(2);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'an unknown configuration names the near match, and a required configuration cannot be left out',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const unknown = await run(sandbox.path, ['init', '--yes', '--configurations', 'bassh', ...QUIET]);
            expect(unknown.code).toBe(2);
            expect(unknown.stderr).toContain('Did you mean `bash`');
            const required = await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'bash',
                '--without',
                'structure',
                ...QUIET,
            ]);
            expect(required.code).toBe(2);
            expect(required.stderr).toContain('bash requires structure');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'uncommitted changes stop init until --allow-dirty is given',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
            const refused = await run(sandbox.path, ['init', '--yes', '--configurations', 'bash', ...QUIET]);
            expect(refused.code).toBe(2);
            expect(refused.stderr).toContain('--allow-dirty');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            const allowed = await run(
                sandbox.path,
                ['init', '--yes', '--configurations', 'bash', '--allow-dirty', ...QUIET],
                {
                    PATH: `${join(import.meta.dir, '../../../../node_modules/.bin')}${delimiter}${toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos', 'ec'])}`,
                },
            );
            expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a recommended configuration is installed unless --without names it',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                sandbox.path,
                ['init', '--yes', '--configurations', 'bash', '--without', 'naming', ...QUIET],
                environment,
            );
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('"formatting"');
            expect(policy).not.toContain('"naming"');
            const check = await run(sandbox.path, ['check', '--only', 'naming/identifiers'], environment);
            expect(check.code).toBe(2);
            expect(check.stdout).toContain('No selected configuration runs a check called `naming/identifiers`');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'one --scope flag writes both scopes with their configurations',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'tools/a.sh': script, 'jobs/b.sh': script });
            commitAll(sandbox.path);
            const argv = ['init', '--yes', '--no-hooks', '--scope', 'tools=bash', 'jobs=bash', ...QUIET];
            const init = await run(sandbox.path, argv, { PATH: toolsPath(['shellcheck', 'shfmt', 'typos', 'ec']) });
            expect(init.code, init.stdout + init.stderr).toBe(0);
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            const parsed = parsePolicyText(policy, 'gspot.toml');
            expect(parsed.scopes.find((scope) => scope.path === 'tools')?.configurations).toContain('bash');
            expect(parsed.scopes.find((scope) => scope.path === 'jobs')?.configurations).toContain('bash');
        },
        PLANTED_TIMEOUT_MS,
    );
});

test('initialization flags control integrations and formatter carryover in the proposal', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const command = [
        'init',
        '--yes',
        '--configurations',
        'javascript',
        '--no-hooks',
        '--no-ci',
        '--no-runner',
        '--no-rules',
        '--no-install',
        '--dry-run',
        '--json',
    ];
    const kept = await run(sandbox.path, [...command, '--format', 'keep']);
    expect(kept.code, kept.stdout + kept.stderr).toBe(0);
    const keptProposal = JSON.parse(kept.stdout) as { policy: string };
    const keptPolicy = parsePolicyText(keptProposal.policy, 'gspot.toml');
    expect(keptPolicy).not.toHaveProperty('hooks');
    expect(keptPolicy).not.toHaveProperty('ci');
    expect(keptPolicy).not.toHaveProperty('runner');
    expect(keptPolicy.format.semicolons).toBe(false);
    const shipped = await run(sandbox.path, [...command, '--format', 'shipped']);
    expect(shipped.code, shipped.stdout + shipped.stderr).toBe(0);
    const shippedProposal = JSON.parse(shipped.stdout) as { policy: string };
    const shippedPolicy = parsePolicyText(shippedProposal.policy, 'gspot.toml');
    expect(shippedPolicy.format).toStrictEqual({});
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
    const result = await run(sandbox.path, ['init', '--yes', '--no-hooks', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain(path);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
});
