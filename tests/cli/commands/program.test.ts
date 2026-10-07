import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
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
    const installHelp = await runGspot(directory.path, ['install', '--refresh-lockfiles', '--help']);
    expect(installHelp.code, installHelp.stdout + installHelp.stderr).toBe(0);
    expect(installHelp.stdout).toContain('--refresh-lockfiles');
    expect(installHelp.stdout.replaceAll(/\s+/gu, ' ')).toContain('missing or outdated tool lockfiles');
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

test('a package manager version failure retains its tool code and diagnostic in human and JSON output', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'echo example\n',
    });
    const before = readTree(directory.path);
    const run = processes.runBlocking;
    using boundary = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'npm' || command[1] !== '--version') return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'version lookup failed' };
    });
    const human = await runGspot(directory.path, ['apply', '--dry-run']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Cannot determine the npm version for the tool project.\n');
    expect(readTree(directory.path)).toStrictEqual(before);
    const structured = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'tool',
        message: 'Cannot determine the npm version for the tool project.',
    });
    expect(boundary).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({ cwd: directory.path }));
    expect(readTree(directory.path)).toStrictEqual(before);
});
