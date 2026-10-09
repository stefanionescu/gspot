// Flags and input a check run refuses before it reads or changes anything.
import * as os from 'node:os';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';

import {
    FIX_REFUSALS,
    SELECTION_REFUSALS,
    PUSH_INPUT_REFUSALS,
    PUSH_ARGUMENT_REFUSALS,
} from '#tests/config/cli/commands/check/refusals.ts';

// A committed repository with a check whose fixer rewrites the source when it runs.
async function fixableSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const fix = [process.execPath, '-e', String.raw`require('node:fs').writeFileSync('source.txt', 'fixed\n')`];
    const check = `[check."sandbox/fixable"]\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify(fix)}\npaths = ["source.txt"]\nstage = "commit"\n`;
    const sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: check }),
        'source.txt': 'original\n',
    });
    commitAll(sandbox.path);
    return sandbox;
}

test.each(FIX_REFUSALS)('check %p exits 2 and leaves the working tree as it was', async (flags, expected) => {
    await using sandbox = await fixableSandbox();
    const refused = await runGspot(sandbox.path, ['check', ...flags, '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(expected);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
    expect(gitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
});

test.each([...PUSH_INPUT_REFUSALS])(
    'a push hook given $name exits 2 and leaves the working tree as it was',
    async ({ stdin, diagnostic }) => {
        await using sandbox = await fixableSandbox();
        const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
        const refused = await runGspot(
            sandbox.path,
            ['check', '--hook', 'pre-push', '--', 'origin', 'unused'],
            {},
            { stdin: typeof stdin === 'string' ? stdin : Buffer.from(stdin) },
        );
        expect(refused.code).toBe(2);
        expect(refused.stderr).toContain(diagnostic);
        expect(Object.getOwnPropertyDescriptor(process, 'stdin')).toStrictEqual(originalStdin);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(gitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
    },
);

test('a staged check during a merge conflict exits 2 with the conflict named and leaves no snapshot', async () => {
    await using sandbox = await fixableSandbox();
    gitOutput(sandbox.path, ['checkout', '-qb', 'other']);
    await writeFile(join(sandbox.path, 'source.txt'), 'other\n');
    gitOutput(sandbox.path, ['commit', '-qam', 'Other']);
    gitOutput(sandbox.path, ['checkout', '-q', '-']);
    await writeFile(join(sandbox.path, 'source.txt'), 'main\n');
    gitOutput(sandbox.path, ['commit', '-qam', 'Main']);
    expect(git(sandbox.path, ['merge', '-q', 'other']).code).not.toBe(0);
    await using temporary = await testdir();
    const temporaryDirectory = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    try {
        const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Resolve index conflicts');
        expect(await readdir(temporary.path)).toStrictEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
});

test('a staged check over a file name that is not UTF-8 exits 2 and leaves no snapshot', async () => {
    await using sandbox = await fixableSandbox();
    const hash = gitOutput(sandbox.path, ['rev-parse', 'HEAD:source.txt']);
    // The index takes the raw name on standard input; most file systems refuse to hold it.
    const name = Buffer.concat([Buffer.from('bad-'), Buffer.from([0xff]), Buffer.from('.txt')]);
    const line = Buffer.concat([Buffer.from(`100644 ${hash}\t`), name, Buffer.from('\n')]);
    const command = ['git', 'update-index', '--index-info'];
    const prepared = prepareTestCommand(command, { cwd: sandbox.path }, 'index a raw filename');
    const indexed = Bun.spawn(command, {
        cwd: sandbox.path,
        stdin: line,
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
    });
    expect(await indexed.exited, await new Response(indexed.stderr).text()).toBe(0);
    await using temporary = await testdir();
    const temporaryDirectory = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    try {
        const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Revision paths must be valid');
        expect(await readdir(temporary.path)).toStrictEqual([]);
    } finally {
        temporaryDirectory.mockRestore();
    }
});

test.each(SELECTION_REFUSALS)('check with %s exits 2 and names the problem', async (_, argv, expected) => {
    await using sandbox = await fixableSandbox();
    const refused = await runGspot(sandbox.path, [...argv]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(expected);
});

test.each(PUSH_ARGUMENT_REFUSALS)(
    'a pre-push hook reports $name in human and JSON output',
    async ({ arguments: argv }) => {
        await using sandbox = await fixableSandbox();
        for (const json of [false, true]) {
            const refused = await runGspot(
                sandbox.path,
                ['check', '--hook', 'pre-push', ...(json ? ['--json'] : []), '--', ...argv],
                {},
                { stdin: '' },
            );
            expect(refused.code).toBe(2);
            const { stdout, stderr } = refused;
            const diagnostic = 'Pre-push expects the remote name and URL supplied by Git.';
            if (json) {
                expect(JSON.parse(stdout) as CommandFailureJson).toStrictEqual({
                    error: 'selection',
                    message: diagnostic,
                });
                expect(stderr).toBe('');
            } else {
                expect(stdout).toBe('');
                expect(stderr).toBe(`${diagnostic}\n`);
            }
            expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
            expect(gitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
        }
    },
);
