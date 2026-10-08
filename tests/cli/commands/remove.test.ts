// Policy edits apply their configuration without installing tools; explicit installation failures preserve the policy.
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { readPolicy } from '#cli/policy/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { INSTALLATION_MUTATIONS } from '#tests/config/cli/commands/remove.ts';

test.each([
    [
        'a configuration another configuration requires',
        ['remove', 'javascript'],
        'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
        2,
    ],
    ['a configuration the selection does not list', ['remove', 'bash'], 'nothing to remove', 0],
    ['a configuration a scope does not list', ['remove', 'typescript', '--scope', 'api'], 'nothing to remove', 0],
])('removing %s preserves the policy and reports the prescribed outcome', async (_, argv, expected, code) => {
    await using sandbox = await testdir();
    const policy =
        'configurations = ["typescript"]\n[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = ["bash"]\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(code);
    expect(refused.stdout).toBe(code === 0 ? `${expected}\n` : '');
    expect(refused.stderr).toBe(code === 0 ? '' : `${expected}\n`);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(code);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual(
        code === 0 ? { changed: false } : { error: 'policy', message: expected },
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(INSTALLATION_MUTATIONS)(
    '$name applies its written policy without acquiring npm tools',
    async ({ argv, policy, configurations }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'README.md': '# Example\n',
            'api/entry.sh': 'echo api\n',
        });
        commitAll(sandbox.path);
        const run = processes.run;
        const installations: string[][] = [];
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'run').mockImplementation((command, options) => {
                if (command[0] === 'npm' && command[1] !== '--version') installations.push([...command]);
                return run(command, options);
            }),
        );
        const result = await runGspot(sandbox.path, [...argv, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
        expect(installations).toStrictEqual([]);
        expect(result.stdout + result.stderr).toContain('Run: gspot install');
        const saved = readPolicy(sandbox.path).policy;
        expect(saved.scope['api']!.configurations).toStrictEqual(configurations);
        expect(saved.configurations).toStrictEqual(['markdown']);
        expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        expect(await pathExists(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
    },
);

test('an unexpected installer process error reaches the program failure handler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["markdown"]\n[agent_rules]\nenabled = false\n',
        'README.md': '# Example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const policy = await readFile(join(sandbox.path, 'gspot.toml'));
    const before = await readTree(sandbox.path);
    const run = processes.run;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'npm') return run(command, options);
            return Promise.reject(new Error('Unexpected process failure.'));
        }),
    );
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('gspot stopped: Unexpected process failure.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'failure', message: 'Unexpected process failure.' });
    expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(['security', 'duplication', 'licenses', 'prose', 'naming', 'structure', 'gspot'])(
    'editing automatic %s coverage refuses before writing policy or generated files',
    async (configuration) => {
        await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'source.py': 'PORT = 8080\n' });
        const before = await readTree(sandbox.path);
        for (const command of ['add', 'remove'])
            for (const flags of [[], ['--dry-run'], ['--json'], ['--dry-run', '--json']]) {
                const result = await runGspot(sandbox.path, [command, configuration, ...flags]);
                expect(result.code, result.stdout + result.stderr).toBe(2);
                expect(result.stdout + result.stderr).toContain('Change coverage with gspot set level');
                expect(await readTree(sandbox.path)).toStrictEqual(before);
            }
    },
);
