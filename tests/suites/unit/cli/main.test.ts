import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { NEEDS_GIT_MESSAGE } from '#tests/config/git.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    COMMAND_TERMS,
    ARGUMENT_ERRORS,
    VERSION_ARGUMENTS,
    MALFORMED_SETTINGS,
    JSON_ARGUMENT_ERRORS,
} from '#tests/config/main.ts';

test.each([...ARGUMENT_ERRORS])(
    'an argument error for $name exits 2 in text output before gspot reads a malformed gspot.toml',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
        expect(await runGspot(sandbox.path, commandArguments)).toStrictEqual({
            code: 2,
            stdout: '',
            stderr: `${message}\n`,
        });
    },
);

test('gspot without a command prints the help to stderr and exits 2', async () => {
    await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
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
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });

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
        message: NEEDS_GIT_MESSAGE,
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(VERSION_ARGUMENTS.map((commandArguments) => ({ commandArguments })))(
    'the version arguments $commandArguments print the version without reading settings',
    async ({ commandArguments }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
        const version = await runGspot(sandbox.path, [...commandArguments]);
        expect(version).toStrictEqual({
            code: 0,
            stdout: commandArguments.includes('--json')
                ? JSON.stringify({ version: cliPackage.version }, null, 2) + '\n'
                : cliPackage.version + '\n',
            stderr: '',
        });
    },
);

test('check treats --version after the separator as a file path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        '--version': 'plain text\n',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const checked = await runGspot(sandbox.path, [
        'check',
        '--only',
        'repository/encoding',
        '--json',
        '--',
        '--version',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({
        checks: [{ check: 'repository/encoding', status: 'passed' }],
    });
});

test("the help list shows each command's arguments with choices, required and repeated marks", async () => {
    await using sandbox = await testdir();
    const help = await runGspot(sandbox.path, ['--help']);
    expect(help.code).toBe(0);
    const terms = help.stdout
        .split('\nOptions:', 1)[0]!
        .split('\n')
        .filter((line) => /^ {2}[a-z]/u.test(line))
        .map((line) => line.trim().split(/ {2,}/u, 1)[0]);
    expect(terms).toStrictEqual([...COMMAND_TERMS]);
});
