import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readTree } from '#tests/harness/preservation.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import { ARGUMENT_REFUSALS } from '#tests/config/cli/commands/program.ts';

test.each(ARGUMENT_REFUSALS)(
    'plain command input with $name exits 2 and names the argument problem',
    async ({ arguments: argv, message: diagnostic }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'gspot.toml': 'malformed = [' });
        const failed = await runGspot(directory.path, argv);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stdout).toBe('');
        expect(failed.stderr).toContain(diagnostic);
        expect(failed.stderr).not.toContain('valid TOML');
    },
);

test.each(
    ARGUMENT_REFUSALS.flatMap(({ arguments: argv, ...entry }) => [
        { ...entry, position: 'before', argv: ['--json', ...argv] },
        {
            ...entry,
            position: 'after',
            argv: [...argv, '--json'],
            message: 'jsonAfterMessage' in entry ? entry.jsonAfterMessage : entry.message,
        },
    ]),
)(
    'JSON command input with $name and its flag $position emits one structured error',
    async ({ argv, message: diagnostic }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'gspot.toml': 'malformed = [' });
        const failed = await runGspot(directory.path, argv);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stderr).toBe('');
        const report = JSON.parse(failed.stdout) as CommandFailureJson;
        expect(report.error).toBe('arguments');
        expect(report.message).toContain(diagnostic);
        expect(report.message).not.toContain('valid TOML');
    },
);

test('help remains readable and exits 0 after a structured argument failure', async () => {
    await using directory = await testdir();
    const failed = await runGspot(directory.path, ['check', '--unknown', '--json']);
    expect(failed.code).toBe(2);
    const help = await runGspot(directory.path, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toContain('Usage: gspot');
    expect(help.stdout).toContain('Commands:');
});

test.each(['-h', '--help'])('ignore %s describes root-wide ignores and removal of multiple entries', async (flag) => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': 'malformed = [' });
    const before = readTree(directory.path);
    const help = await runGspot(directory.path, ['ignore', flag]);
    expect(help.code, help.stdout + help.stderr).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout.replaceAll(/\s+/gu, ' ')).toContain(
        'Apply the ignore to these paths only; without it, everywhere',
    );
    expect(help.stdout).toContain('Delete the matching ignore entries');
    expect(help.stdout).not.toContain('--scope');
    expect(readTree(directory.path)).toStrictEqual(before);
});
