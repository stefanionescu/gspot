import { test, spyOn, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { ARGUMENT_ERRORS } from '#tests/data/commands/errors.ts';

test.each([...ARGUMENT_ERRORS])(
    'text output for $name exits 2 and names the argument problem',
    async ({ arguments: commandArguments, message }) => {
        await using folder = await testdir();
        await createFileTree(folder.path, { 'gspot.toml': 'malformed = [' });
        const failed = await runGspot(folder.path, commandArguments);
        expect(failed.code, failed.stdout + failed.stderr).toBe(2);
        expect(failed.stdout).toBe('');
        expect(failed.stderr).toContain(message);
        expect(failed.stderr).not.toContain('valid TOML');
    },
);

test.each(
    ARGUMENT_ERRORS.map(({ arguments: commandArguments, ...entry }) => ({
        ...entry,
        position: 'after',
        commandArguments: [...commandArguments, '--json'],
        message: 'jsonAfterMessage' in entry ? entry.jsonAfterMessage : entry.message,
    })),
)('JSON output for $name with --json $position gives one error object', async ({ commandArguments, message }) => {
    await using folder = await testdir();
    await createFileTree(folder.path, { 'gspot.toml': 'malformed = [' });
    const failed = await runGspot(folder.path, commandArguments);
    expect(failed.code, failed.stdout + failed.stderr).toBe(2);
    expect(failed.stderr).toBe('');
    const report = JSON.parse(failed.stdout) as CommandFailureJson;
    expect(report.error).toBe('arguments');
    expect(report.message).toContain(message);
    expect(report.message).not.toContain('valid TOML');
});

test('help works and exits 0 after an argument error', async () => {
    await using folder = await testdir();
    const failed = await runGspot(folder.path, ['check', '--unknown', '--json']);
    expect(failed.code).toBe(2);
    const help = await runGspot(folder.path, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stderr).toBe('');
    expect(help.stdout).toContain('Usage: gspot');
    expect(help.stdout).toContain('Set up a repository:');
    expect(help.stdout).toContain('Run the checks:');
    expect(help.stdout).toContain('Change gspot.toml:');
});

test('apply starts no npm, and install reports a failed npm version lookup in text and JSON', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(folder.path);
    const run = processes.spawnProcessBlocking;
    using boundary = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'npm' || command[1] !== '--version') return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'version lookup failed' };
    });
    const preview = await runGspot(folder.path, ['apply', '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(boundary).not.toHaveBeenCalledWith(['npm', '--version'], expect.anything());
    const human = await runGspot(folder.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe(
        'Cannot determine the npm version for the tool project.\nTool installation is incomplete. Run: gspot install\n',
    );
    expect(await readTree(folder.path)).toStrictEqual(before);
    const structured = await runGspot(folder.path, ['install', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'installation',
        message:
            'Cannot determine the npm version for the tool project.\nTool installation is incomplete. Run: gspot install',
    });
    expect(boundary).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({ cwd: folder.path }));
    expect(await readTree(folder.path)).toStrictEqual(before);
});
