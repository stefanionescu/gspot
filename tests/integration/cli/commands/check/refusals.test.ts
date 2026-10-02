// Flags and input a check run refuses before it reads or changes anything.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { gspot, runGspot } from '#tests/harness/cli/command.ts';
import { commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
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
