import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { NEEDS_GIT_MESSAGE } from '#tests/config/git.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { VERSION_ARGUMENTS, MALFORMED_SETTINGS, JSON_ARGUMENT_ERRORS } from '#tests/config/main.ts';

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

test('an unknown command exits 2 and names the closest command', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['checks']);
    expect(result).toStrictEqual({
        code: 2,
        stdout: '',
        stderr: 'There is no command called checks. Did you mean check? Run gspot --help to see the commands.\n',
    });
});

test.each(
    [
        ['init'],
        ['install'],
        ['apply'],
        ['check'],
        ['list'],
        ['explain', 'python'],
        ['doctor'],
        ['set', 'level', 'all'],
        ['unset', 'level'],
        ['add', 'python'],
        ['remove', 'python', '--reason', 'External tools check this language.'],
        ['ignore', 'repository/encoding', '--reason', 'External tooling checks these files.'],
        ['unignore', 'repository/encoding'],
    ].map((commandArguments) => ({ commandArguments })),
)(
    '$commandArguments requires a Git worktree before reading settings or writing, while its help works outside Git',
    async ({ commandArguments }) => {
        await using sandbox = await testdir({ 'gspot.toml': MALFORMED_SETTINGS });
        const before = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(result.code).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'git', message: NEEDS_GIT_MESSAGE });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const help = await runGspot(sandbox.path, [commandArguments[0]!, '--help']);
        expect(help.code).toBe(0);
        expect(help.stdout).toContain('Usage:');
    },
);

test('a sparse checkout is refused before reading settings and help remains available', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': MALFORMED_SETTINGS });
    runGitStep(sandbox.path, ['config', 'core.sparseCheckout', 'yes']);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'git',
        message: 'gspot does not support sparse checkouts. Run git sparse-checkout disable.',
    });
    expect(await readTree(sandbox.path)).toEqual(before);
    const help = await runGspot(sandbox.path, ['doctor', '--help']);
    expect(help.code).toBe(0);
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
