import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import type { CommandFailureJson } from '#cli/types/system.ts';
import { JSON_ARGUMENT_ERRORS, MALFORMED_SETTINGS, VERSION_ARGUMENTS } from '#tests/config/main.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('gspot without a command prints the help to stderr and exits 2', async () => {
    await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
    const help = await runGspot(sandbox.path, ['--help']);
    expect(await runGspot(sandbox.path, [])).toStrictEqual({ code: 2, stdout: '', stderr: help.stdout });
});

test.each([...JSON_ARGUMENT_ERRORS])(
    'an argument error for $name with --json prints one arguments error object before gspot reads a malformed gspot.toml',
    async ({ arguments: commandArguments }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });

        const failed = await runGspot(sandbox.path, commandArguments);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toBe('');
        expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'arguments' });
    },
);

test('an argument error wins over a repository error', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['check', '--staged', '--fix', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
});

test('an unknown command exits 2 and names the closest command', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['checks', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringMatching(/\bcheck\b/u) as string,
    });
});

test('init requires a Git worktree before reading settings or writing, while its help works outside Git', async () => {
    await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'git' });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('a sparse checkout is refused before reading settings and help remains available', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': MALFORMED_SETTINGS });
    runGitStep(sandbox.path, ['config', 'core.sparseCheckout', 'yes']);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'git',
        message: expect.stringContaining('git sparse-checkout disable') as string,
    });
});

test.each(VERSION_ARGUMENTS.map((commandArguments) => ({ commandArguments })))(
    'the version arguments $commandArguments print the version without reading settings',
    async ({ commandArguments }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
        const version = await runGspot(sandbox.path, [...commandArguments]);
        expect(version).toStrictEqual({
            code: 0,
            stdout:
                (commandArguments.includes('--json')
                    ? JSON.stringify({ version: cliPackage.version, exitCode: 0, notes: [] }, null, 2)
                    : cliPackage.version) + '\n',
            stderr: '',
        });
    },
);

test.each([
    { commandArguments: ['--version', 'extra'], refused: 'extra' },
    { commandArguments: ['check', '--version'], refused: '--version' },
])('$commandArguments exits 2 instead of printing the version', async ({ commandArguments, refused }) => {
    await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(refused);
});

test('an argument choice names the command and the values to use', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['list', 'bogus', '--json']);
    expect(result.code).toBe(2);
    const { error, message } = JSON.parse(result.stdout) as CommandFailureJson;
    expect(error).toBe('arguments');
    for (const named of ['gspot list', 'configurations', 'settings']) expect(message).toContain(named);
});

test.each([[], ['check']])('the help of %p fits 80 columns', async (...commandArguments) => {
    await using sandbox = await testdir();
    const help = await runGspot(sandbox.path, [...commandArguments, '--help']);
    expect(help.code).toBe(0);
    expect(help.stdout.split('\n').filter((line) => line.length > 80)).toStrictEqual([]);
});

test('the help of check fits a terminal narrower than 80 columns', async () => {
    await using sandbox = await testdir();
    const columns = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
    try {
        const help = await runGspot(sandbox.path, ['check', '--help']);
        expect(help.code).toBe(0);
        expect(help.stdout.split('\n').filter((line) => line.length > 60)).toStrictEqual([]);
    } finally {
        if (columns === undefined) Reflect.deleteProperty(process.stdout, 'columns');
        else Object.defineProperty(process.stdout, 'columns', columns);
    }
});

test('check treats --version after the separator as a file path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        '--version': 'plain text\n',
    });
    runGitStep(sandbox.path, ['add', '.']);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'repository/encoding', '--json', '--', '--version']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ check: 'repository/encoding', status: 'passed', fileCount: 1 }]);
});

test('--verbose before the command reaches check, which then prints its passed checks', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'notes.txt': 'plain\n' });
    runGitStep(sandbox.path, ['add', '.']);
    const checked = await runGspot(sandbox.path, ['--verbose', 'check', '--only', 'repository/encoding']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toMatch(/^passed +repository\/encoding +\d+ files? /mu);
});

test('a command refuses a removed configuration that gspot does not ship', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': `removed_configurations = { python3 = "The sample needs no Python checks." }\n`,
    });
    const refused = await runGspot(sandbox.path, ['list']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('There is no configuration called python3.');
});

test('an option error after a global flag names the help of its command', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const refused = await runGspot(sandbox.path, ['--verbose', 'list', '--foo']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('Run gspot list --help');
});

test('an option value that reads --json leaves the output as text', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['ignore', 'x', '--reason', '--json']);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toBe('');
});
