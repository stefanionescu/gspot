import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';

import {
    ARGUMENT_ERRORS,
    COMMAND_VALUE_ERRORS,
    JSON_ARGUMENT_ERRORS,
    COMMAND_VALUE_SETTINGS,
} from '#tests/data/main.ts';

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
    expect(help.stdout).toContain('Set up a repository:');
    expect(help.stdout).toContain('Run the checks:');
    expect(help.stdout).toContain('Change gspot.toml:');
    for (const { summary } of Object.values(COMMAND_HELP)) expect(help.stdout).toContain(summary);
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
test.each([...COMMAND_VALUE_ERRORS])(
    '$name reports arguments in text and JSON without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': COMMAND_VALUE_SETTINGS,
            'control.txt': 'preserve this source\n',
        });
        const before = await readTree(sandbox.path);
        const human = await runGspot(sandbox.path, commandArguments);
        expect(human.code).toBe(2);
        expect(human.stdout).toBe('');
        expect(human.stderr).toBe(`${message}\n`);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(structured.code).toBe(2);
        expect(structured.stderr).toBe('');
        expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'arguments', message });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
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
