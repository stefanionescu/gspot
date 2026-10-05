// gspot add and remove: the configuration joins or leaves the selection, and a failed install keeps the policy and says what to run.
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { commitAll } from '#tests/harness/git.ts';
import { existsSync, readFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { INSTALLATION_MUTATIONS } from '#tests/config/cli/commands/remove.ts';

test.each([
    [
        'a configuration another configuration requires',
        ['remove', 'javascript'],
        'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
    ],
    [
        'a configuration the selection does not list',
        ['remove', 'bash'],
        '`bash` is not in the root configurations, so there is nothing to remove. Run gspot list to see the selected configurations.',
    ],
    [
        'a configuration a scope does not list',
        ['remove', 'typescript', '--scope', 'api'],
        '`typescript` is not in the configurations of scope api, so there is nothing to remove. Run gspot list to see the selected configurations.',
    ],
])('removing %s exits 2 and leaves the policy as it was', async (_, argv, expected) => {
    await using sandbox = await testdir();
    const policy =
        'configurations = ["typescript"]\n[agent_rules]\nenabled = false\n[[scope]]\npath = "api"\nconfigurations = ["bash"]\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain(expected);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${expected}\n`);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'policy', message: expected });
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test.each(INSTALLATION_MUTATIONS)(
    '$name preserves its written policy and reports a repair command after npm acquisition fails',
    async ({ argv, policy, configurations }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'README.md': '# Example\n',
            'api/entry.sh': 'echo api\n',
        });
        commitAll(sandbox.path);
        const run = processes.run;
        using resources = new DisposableStack();
        resources.use(
            spyOn(processes, 'run').mockImplementation((command, options) => {
                if (command[0] !== 'npm' || command[1] === '--version') return run(command, options);
                return Promise.resolve({
                    code: 1,
                    missing: false,
                    stdout: '',
                    stderr: 'Registry acquisition failed.',
                    duration: 1,
                });
            }),
        );
        const result = await runGspot(sandbox.path, [...argv, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({
            error: 'installation',
            message: textContaining('Run: gspot install'),
        });
        expect(result.stdout + result.stderr).toContain('Tool installation is incomplete');
        expect(result.stdout + result.stderr).toContain('Run: gspot install');
        expect(result.stdout + result.stderr).toContain('Registry acquisition failed.');
        const saved = readPolicy(sandbox.path).policy;
        expect(saved.scopes.find((scope) => scope.path === 'api')!.configurations).toStrictEqual(configurations);
        expect(saved.configurations).toStrictEqual(['markdown']);
        expect(existsSync(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        expect(existsSync(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
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
    const policy = readFileSync(join(sandbox.path, 'gspot.toml'));
    const before = readTree(sandbox.path);
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
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'failure', message: 'Unexpected process failure.' });
    expect(readFileSync(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
    expect(existsSync(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
    expect(readTree(sandbox.path)).toStrictEqual(before);
});
