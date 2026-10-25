import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { ARGUMENT_ERRORS, JSON_ARGUMENT_ERRORS } from '#tests/config/main.ts';

test.each([...ARGUMENT_ERRORS])(
    'an argument error for $name exits 2 in text output before gspot reads a malformed gspot.toml',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await testdir({ 'gspot.toml': 'malformed = [' });
        expect(await runGspot(sandbox.path, commandArguments)).toStrictEqual({
            code: 2,
            stdout: '',
            stderr: `${message}\n`,
        });
    },
);

test('gspot without a command prints the help to stderr and exits 2', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'malformed = [' });
    const help = await runGspot(sandbox.path, ['--help']);
    expect(await runGspot(sandbox.path, [])).toStrictEqual({ code: 2, stdout: '', stderr: help.stdout });
});

test('gspot --help prints each help group and the summary of every command', async () => {
    await using sandbox = await testdir();
    const help = await runGspot(sandbox.path, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toStartWith('Usage: gspot <command> [options]\n');
    expect(
        help.stdout
            .split('\nOptions:', 1)[0]!
            .matchAll(/^ {2}([a-z]+) /gmu)
            .map(([, name]) => name)
            .toArray(),
    ).toStrictEqual([
        'init',
        'install',
        'apply',
        'check',
        'add',
        'remove',
        'set',
        'unset',
        'ignore',
        'unignore',
        'list',
        'explain',
        'doctor',
    ]);
});

test.each([...JSON_ARGUMENT_ERRORS])(
    'an argument error for $name with --json prints one arguments error object before gspot reads a malformed gspot.toml',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await testdir({ 'gspot.toml': 'malformed = [' });

        const failed = await runGspot(sandbox.path, commandArguments);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toBe('');
        expect(JSON.parse(failed.stdout) as CommandFailureJson).toStrictEqual({ error: 'arguments', message });
    },
);
test('an unknown command exits 2 and names the closest command', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['checks']);
    expect(result).toStrictEqual({
        code: 2,
        stdout: '',
        stderr: 'Unknown command checks. Did you mean check? Run gspot --help to see the commands.\n',
    });
});

test.each(['init', 'install', 'apply', 'check'])('%s refuses a folder outside Git before writing', async (command) => {
    await using sandbox = await testdir({ 'package.json': '{"private":true}' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [command, ...(command === 'init' ? ['--yes'] : []), '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'git',
        message: 'gspot needs a Git repository. Run git init, then gspot init.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
