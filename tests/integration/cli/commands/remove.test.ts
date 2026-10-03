// gspot add and remove: the kit joins or leaves the selection, and a failed install keeps the policy and says what to run.
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import * as steps from '#cli/commands/install/steps.ts';
import { runGspot } from '#tests/harness/cli/command.ts';

const BASH_IN_API = `kits = []
[rules]
install = false
[[scope]]
path = "api"
kits = ["bash"]
`;

test('removing a kit from a scope deletes the outputs only it needed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BASH_IN_API, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, '.gspot/config/shellcheckrc'))).toBe(true);
    const removed = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('removed bash from scope api');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('path = "api"\nkits = []');
    expect(existsSync(join(sandbox.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test.each([
    ['a kit another kit requires', ['remove', 'javascript'], 'typescript requires javascript'],
    ['a kit the selection does not list', ['remove', 'bash'], 'bash'],
    ['a kit a scope does not list', ['remove', 'typescript', '--scope', 'api'], 'typescript'],
])('removing %s exits 2 and leaves the policy as it was', async (_, argv, expected) => {
    await using sandbox = await testdir();
    const policy = 'kits = ["typescript"]\n[rules]\ninstall = false\n[[scope]]\npath = "api"\nkits = ["bash"]\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain(expected);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});

test.each([
    ['add', ['add', 'bash', '--scope', 'api']],
    ['remove', ['remove', 'bash', '--scope', 'api']],
])('%s keeps the written policy and says to run gspot install when the install fails', async (_, argv) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': argv[0] === 'add' ? BASH_IN_API.replace('kits = ["bash"]', 'kits = []') : BASH_IN_API,
        'api/entry.sh': 'echo api\n',
    });
    commitAll(sandbox.path);
    using failing = spyOn(steps, 'installTools').mockRejectedValue(
        new AggregateError([new GspotError('installation', 'npm install failed')], 'npm install failed'),
    );
    const result = await runGspot(sandbox.path, argv);
    expect(failing).toHaveBeenCalled();
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout).toContain('tool installation is incomplete. Run: gspot install');
    const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(policy).toContain(argv[0] === 'add' ? 'path = "api"\nkits = ["bash"]' : 'path = "api"\nkits = []');
});
