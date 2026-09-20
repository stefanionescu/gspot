// Planted repositories: what init refuses before it writes, and that every hook runs under the Bash macOS ships.
import { delimiter, join } from 'node:path';
import { hookBody } from '#cli/emit/hooks.ts';
import { createSandbox } from '@gspot/testing';
import { chmodSync, existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { treeContents } from '#tests/harness/contents.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { commitAll, git, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const SYSTEM_BASH = '/bin/bash';
const QUIET = ['--no-runner', '--no-ci', '--no-rules', '--no-install'];

describe('init refusals', () => {
    test(
        'a choice flag outside its list exits 2 and names the allowed values',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
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
        'an unknown preset names the near match, and a required preset cannot be left out',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const unknown = await run(sandbox.path, ['init', '--yes', '--presets', 'bassh', ...QUIET]);
            expect(unknown.code).toBe(2);
            expect(unknown.stderr).toContain('Did you mean `bash`');
            const required = await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
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
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            commitAll(sandbox.path);
            await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
            const refused = await run(sandbox.path, ['init', '--yes', '--presets', 'bash', ...QUIET]);
            expect(refused.code).toBe(2);
            expect(refused.stderr).toContain('--allow-dirty');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            const allowed = await run(sandbox.path, ['init', '--yes', '--presets', 'bash', '--allow-dirty', ...QUIET], {
                PATH: `${join(import.meta.dir, '../../../node_modules/.bin')}${delimiter}${toolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos', 'ec'])}`,
            });
            expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.skipIf(!existsSync(SYSTEM_BASH))('every hook body runs under the system Bash', async () => {
        await using sandbox = await createSandbox({ 'README.md': '# Hook test\n' });
        commitAll(sandbox.path);
        const remote = 'https://example.com/planted.git';
        expect(git(sandbox.path, ['remote', 'add', 'origin', remote]).code).toBe(0);
        const argumentsByHook = {
            'pre-commit': [],
            'pre-push': ['origin', remote],
            'commit-msg': ['message-file'],
        };
        for (const name of ['pre-commit', 'pre-push', 'commit-msg'] as const) {
            const path = join(sandbox.path, name);
            await Bun.write(path, hookBody(name, 'none', '/bin/echo'));
            chmodSync(path, 0o755);
            const result = Bun.spawnSync([SYSTEM_BASH, path, ...argumentsByHook[name]], {
                cwd: sandbox.path,
                env: { PATH: toolsPath([]), GSPOT_BIN: '' },
                stdin: 'ignore',
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(result.stderr.toString()).toBe('');
            expect(result.exitCode).toBe(0);
            expect(result.stdout.toString()).toContain('check');
        }
    });

    test(
        'a recommended preset is installed unless --without names it',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                sandbox.path,
                ['init', '--yes', '--presets', 'bash', '--without', 'naming', ...QUIET],
                environment,
            );
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('"formatting"');
            expect(policy).not.toContain('"naming"');
            const check = await run(sandbox.path, ['check', '--only', 'naming/identifiers'], environment);
            expect(check.code).toBe(2);
            expect(check.stdout).toContain('No selected preset runs a check called `naming/identifiers`');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'one --scope flag writes both scopes with their presets',
        async () => {
            await using sandbox = await createSandbox({ 'tools/a.sh': script, 'jobs/b.sh': script });
            commitAll(sandbox.path);
            const argv = ['init', '--yes', '--no-hooks', '--scope', 'tools=bash', 'jobs=bash', ...QUIET];
            const init = await run(sandbox.path, argv, { PATH: toolsPath(['shellcheck', 'shfmt', 'typos', 'ec']) });
            expect(init.stderr).not.toContain('did not run');
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('path = "tools"');
            expect(policy).toContain('path = "jobs"');
        },
        PLANTED_TIMEOUT_MS,
    );
});

test('initialization flags control integrations and formatter carryover in the proposal', async () => {
    await using sandbox = await createSandbox({
        'source.js': 'export const port = 8080;\n',
        '.prettierrc.json': '{"semi":false,"tabWidth":8}\n',
    });
    const command = [
        'init',
        '--yes',
        '--presets',
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
    expect([keptPolicy.hooks.tool, keptPolicy.ci.provider, keptPolicy.runner.tool]).toEqual(['none', 'none', 'none']);
    expect(keptPolicy.format.semicolons).toBe(false);
    const shipped = await run(sandbox.path, [...command, '--format', 'shipped']);
    expect(shipped.code, shipped.stdout + shipped.stderr).toBe(0);
    const shippedProposal = JSON.parse(shipped.stdout) as { policy: string };
    const shippedPolicy = parsePolicyText(shippedProposal.policy, 'gspot.toml');
    expect(shippedPolicy.format).toEqual({});
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
    await using sandbox = await createSandbox({ [path]: content, 'source.ts': 'export {};\n' });
    const before = treeContents(sandbox.path);
    const result = await run(sandbox.path, ['init', '--yes', '--no-hooks', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(path);
    expect(treeContents(sandbox.path)).toEqual(before);
});
