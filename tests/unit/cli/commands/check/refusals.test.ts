import * as os from 'node:os';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { prepareCommand } from '#tests/setup/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { MILLISECONDS_PER_SECOND } from '#tests/data/test-setup.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { FIX_REFUSALS, ARGUMENT_REFUSALS, PUSH_INPUT_REFUSALS } from '#tests/data/commands/check.ts';

test('only refuses a commit message check outside the message stage', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText(['commits']) });
    commitAll(sandbox.path);
    const refused = await runGspot(sandbox.path, ['check', '--only', 'commits/commitlint']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr.trim()).toBe(
        'commits/commitlint checks commit messages. Run gspot check --hook commit-msg -- <file>.',
    );
});

test.each(['--changed', '--staged', '--hook'])('%s outside Git reports a setup error', async (flag) => {
    await using sandbox = await testdir();
    const settings = `configurations = []
[[command_check]]
name = "sandbox/paths"
command = ["node", "-e", "process.exitCode=0"]
paths = ["api/**"]
stage = "commit"
`;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'api/source.txt': 'before' });
    const result = await runGspot(sandbox.path, ['check', flag, ...(flag === '--hook' ? ['pre-push'] : []), '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toBe(
        `${flag === '--hook' ? '--hook pre-push' : flag} needs a Git repository.`,
    );
    expect((JSON.parse(result.stdout) as CommandFailureJson).error).toBe('git');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
    expect(await Bun.file(join(sandbox.path, 'api/source.txt')).text()).toBe('before');
});

// A committed repository with a check whose fixer rewrites the source when it runs.
async function createFixableSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const fix = [process.execPath, '-e', String.raw`require('node:fs').writeFileSync('source.txt', 'fixed\n')`];
    const check = `[[command_check]]
name = "sandbox/fixable"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix = ${JSON.stringify(fix)}
paths = ["source.txt"]
stage = "commit"
`;
    const sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { tables: check }),
        'source.txt': 'original\n',
    });
    commitAll(sandbox.path);
    return sandbox;
}

test.each([...FIX_REFUSALS])('check %p exits 2 and leaves the working tree as it was', async (flags, expected) => {
    await using sandbox = await createFixableSandbox();
    const refused = await runGspot(sandbox.path, ['check', ...flags, '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(expected);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
    expect(readGitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
});

test.each([...PUSH_INPUT_REFUSALS])(
    'a pre-push check given $name exits 2 and leaves the working tree as it was',
    async ({ stdin, message }) => {
        await using sandbox = await createFixableSandbox();
        const refused = await runGspot(
            sandbox.path,
            ['check', '--hook', 'pre-push', '--', 'origin', 'unused'],
            {},
            { stdin: typeof stdin === 'string' ? stdin : Buffer.from(stdin) },
        );
        expect(refused.code).toBe(2);
        expect(refused.stderr).toContain(message);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(readGitOutput(sandbox.path, ['status', '--porcelain'])).toBe('');
    },
);

test('a staged check during a merge conflict exits 2, names the conflict, and leaves no scratch copy', async () => {
    await using sandbox = await createFixableSandbox();
    readGitOutput(sandbox.path, ['checkout', '-qb', 'other']);
    await writeFile(join(sandbox.path, 'source.txt'), 'other\n');
    readGitOutput(sandbox.path, ['commit', '-qam', 'Other']);
    readGitOutput(sandbox.path, ['checkout', '-q', '-']);
    await writeFile(join(sandbox.path, 'source.txt'), 'main\n');
    readGitOutput(sandbox.path, ['commit', '-qam', 'Main']);
    expect(runGit(sandbox.path, ['merge', '-q', 'other']).code).not.toBe(0);
    await using temporary = await testdir();
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Resolve index conflicts');
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test('a staged check over a file name that is not UTF-8 exits 2 and leaves no scratch copy', async () => {
    await using sandbox = await createFixableSandbox();
    const hash = readGitOutput(sandbox.path, ['rev-parse', 'HEAD:source.txt']);
    // The index takes the raw name on standard input; most file systems refuse to hold it.
    const name = Buffer.concat([Buffer.from('bad-'), Buffer.from([0xff]), Buffer.from('.txt')]);
    const line = Buffer.concat([Buffer.from(`100644 ${hash}\t`), name, Buffer.from('\n')]);
    const command = ['git', 'update-index', '--index-info'];
    const prepared = prepareCommand(command, { cwd: sandbox.path });
    const indexed = Bun.spawn(command, {
        cwd: sandbox.path,
        stdin: line,
        stderr: 'pipe',
        timeout: Math.ceil(prepared.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
    });
    expect(await indexed.exited, await new Response(indexed.stderr).text()).toBe(0);
    await using temporary = await testdir();
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('Revision paths must be valid');
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test.each([...ARGUMENT_REFUSALS])(
    'check with %s exits 2 and names the problem',
    async (_, commandArguments, expected) => {
        await using sandbox = await createFixableSandbox();
        const refused = await runGspot(sandbox.path, [...commandArguments]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout + refused.stderr).toContain(expected);
    },
);

test('check reports an unreadable message file as an argument error and writes nothing', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText(['commits']) });
    const before = await readTree(sandbox.path);
    const message = `The commit message file ${join(sandbox.path, 'missing-message.txt')} cannot be read.`;
    const human = await runGspot(sandbox.path, ['check', '--hook', 'commit-msg', '--', 'missing-message.txt']);
    expect(human.code).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe(`${message}\n`);
    const structured = await runGspot(sandbox.path, [
        'check',
        '--json',
        '--hook',
        'commit-msg',
        '--',
        'missing-message.txt',
    ]);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'arguments', message });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
