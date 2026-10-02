// Flags and input a check run refuses before it reads or changes anything.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { gspot, runGspot } from '#tests/harness/cli/command.ts';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import { git, commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import type { CommandFailureJson } from '#cli/types/commands/commands.ts';

// A committed repository with a check whose fixer rewrites the source when it runs.
async function fixableSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const fix = [process.execPath, '-e', String.raw`require('node:fs').writeFileSync('source.txt', 'fixed\n')`];
    const check = `[[check]]\nname = "sandbox/fixable"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify(fix)}\npaths = ["source.txt"]\nstage = "commit"\n`;
    const sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], check), 'source.txt': 'original\n' });
    commitAll(sandbox.path);
    return sandbox;
}

test.each([
    [['--staged', '--fix'], 'Staged checks do not run fixers'],
    [['--push', '--fix'], 'Pre-push object checks cannot be combined'],
])('check %p exits 2 and leaves the working tree as it was', async (flags, expected) => {
    await using sandbox = await fixableSandbox();
    const refused = await runGspot(sandbox.path, ['check', ...flags, '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(expected);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
    expect(gitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
});

test.each([
    ['text that is no ref update', Buffer.from('not a ref update\n')],
    ['bytes that are not UTF-8', Buffer.from([0xff, 0xfe, 0x0a])],
])('a push hook given %s exits 2 and leaves the working tree as it was', async (_, stdin) => {
    await using sandbox = await fixableSandbox();
    // The input goes in as bytes, which the product's runner, built for text, cannot send.
    const child = Bun.spawn([process.execPath, gspot, 'check', '--push', '--', 'origin', 'unused'], {
        cwd: sandbox.path,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1' },
        stdin,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(await child.exited).toBe(2);
    expect(await new Response(child.stderr).text()).not.toBe('');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
    expect(gitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
});

// The snapshot folders a staged run made and left in the system temporary folder.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Each refused staged run compares the snapshot folders before and after it through this.
function snapshotFolders(): string[] {
    return readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-revision-'));
}

test('a staged check during a merge conflict exits 2 with the conflict named and leaves no snapshot', async () => {
    await using sandbox = await fixableSandbox();
    gitOutput(sandbox.path, ['checkout', '-qb', 'other']);
    writeFileSync(join(sandbox.path, 'source.txt'), 'other\n');
    gitOutput(sandbox.path, ['commit', '-qam', 'Other']);
    gitOutput(sandbox.path, ['checkout', '-q', '-']);
    writeFileSync(join(sandbox.path, 'source.txt'), 'main\n');
    gitOutput(sandbox.path, ['commit', '-qam', 'Main']);
    expect(git(sandbox.path, ['merge', '-q', 'other']).code).not.toBe(0);
    const before = snapshotFolders();
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Resolve index conflicts');
    expect(snapshotFolders()).toStrictEqual(before);
});

test('a staged check over a file name that is not UTF-8 exits 2 and leaves no snapshot', async () => {
    await using sandbox = await fixableSandbox();
    const hash = gitOutput(sandbox.path, ['rev-parse', 'HEAD:source.txt']);
    // The index takes the raw name on standard input; most file systems refuse to hold it.
    const name = Buffer.concat([Buffer.from('bad-'), Buffer.from([0xff]), Buffer.from('.txt')]);
    const line = Buffer.concat([Buffer.from(`100644 ${hash}\t`), name, Buffer.from('\n')]);
    const indexed = Bun.spawnSync(['git', 'update-index', '--index-info'], { cwd: sandbox.path, stdin: line });
    expect(indexed.exitCode, indexed.stderr.toString()).toBe(0);
    const before = snapshotFolders();
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Revision paths must be valid');
    expect(snapshotFolders()).toStrictEqual(before);
});
