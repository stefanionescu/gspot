// gspot remove: the kit leaves the selection and its outputs go, unless another kit needs it or it was never listed.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
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
