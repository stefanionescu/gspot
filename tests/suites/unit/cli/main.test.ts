import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { NEEDS_GIT_MESSAGE } from '#tests/config/git.ts';
import cliPackage from '#cli-package' with { type: 'json' };
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

test('gspot --help prints each help group, and each command with its arguments and a summary', async () => {
    await using sandbox = await testdir();
    const help = await runGspot(sandbox.path, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toStartWith('Usage: gspot <command> [options]\n');
    const lines = help.stdout.split('\nOptions:', 1)[0]!.split('\n');
    expect(lines.filter((line) => line.endsWith(':'))).toStrictEqual([
        'Set up a repository:',
        'Run the checks:',
        'Change gspot.toml:',
        'Look up:',
    ]);
    const rows = lines.filter((line) => /^ {2}[a-z]/u.test(line)).map((line) => line.trim().split(/ {2,}/u));
    expect(rows.map(([term]) => term)).toStrictEqual([...COMMAND_TERMS]);
    expect(rows.filter(([, summary]) => summary === undefined)).toStrictEqual([]);
});

test.each([...JSON_ARGUMENT_ERRORS])(
    'an argument error for $name with --json prints one arguments error object before gspot reads a malformed gspot.toml',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });

        const failed = await runGspot(sandbox.path, commandArguments);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toBe('');
        expect(JSON.parse(failed.stdout)).toStrictEqual({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'arguments',
            message,
        });
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

test.each([
    { command: 'init', options: ['--yes'] },
    { command: 'install', options: [] },
    { command: 'apply', options: [] },
    { command: 'check', options: [] },
    { command: 'set', options: ['level', 'all'] },
    { command: 'unset', options: ['level'] },
    { command: 'add', options: ['bash'] },
    { command: 'remove', options: ['bash', '--reason', 'The project keeps no shell scripts.'] },
    { command: 'ignore', options: ['bash/shellcheck', '--reason', 'The generated scripts are checked upstream.'] },
    { command: 'unignore', options: ['bash/shellcheck'] },
])('$command refuses a folder outside Git before writing', async ({ command, options }) => {
    await using sandbox = await testdir({ 'package.json': '{"private":true}' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [command, ...options, '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
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
                ? JSON.stringify({ version: cliPackage.version, exitCode: 0, notes: [] }, null, 2) + '\n'
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
