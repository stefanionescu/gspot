import { test, spyOn, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { ARGUMENT_ERRORS } from '#tests/config/terminal.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';

test.each([...ARGUMENT_ERRORS])(
    'text output for $name exits 2 and names the argument problem',
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
    ARGUMENT_ERRORS.map(({ arguments: argv, ...entry }) => ({
        ...entry,
        position: 'after',
        argv: [...argv, '--json'],
        message: 'jsonAfterMessage' in entry ? entry.jsonAfterMessage : entry.message,
    })),
)('JSON output for $name with --json $position gives one error object', async ({ argv, message: diagnostic }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': 'malformed = [' });
    const failed = await runGspot(directory.path, argv);
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    expect(failed.stderr).toBe('');
    const report = JSON.parse(failed.stdout) as CommandFailureJson;
    expect(report.error).toBe('arguments');
    expect(report.message).toContain(diagnostic);
    expect(report.message).not.toContain('valid TOML');
});

test('help works and exits 0 after an argument error', async () => {
    await using directory = await testdir();
    const failed = await runGspot(directory.path, ['check', '--unknown', '--json']);
    expect(failed.code).toBe(2);
    const help = await runGspot(directory.path, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toContain('Usage: gspot');
    expect(help.stdout).toContain('Commands:');
});

test('a failed npm version lookup gives the tool error in text and JSON', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(directory.path);
    const run = processes.spawnProcessBlocking;
    using boundary = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'npm' || command[1] !== '--version') return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'version lookup failed' };
    });
    const human = await runGspot(directory.path, ['apply', '--dry-run']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Cannot determine the npm version for the tool project.\n');
    expect(await readTree(directory.path)).toStrictEqual(before);
    const structured = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'tool',
        message: 'Cannot determine the npm version for the tool project.',
    });
    expect(boundary).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({ cwd: directory.path }));
    expect(await readTree(directory.path)).toStrictEqual(before);
});
