import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('new Python files appear in JSON and one text note until explicitly removed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'main.py': 'PORT = 8080\n',
    });
    const command = ['check', '--only', 'gspot/unmatched-paths'];
    const structured = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.report.notChecked).toContainEqual({ configuration: 'python', evidence: '1 .py file' });
    const text = await runGspot(sandbox.path, command);
    expect(text.code, text.stdout + text.stderr).toBe(0);
    expect(text.stdout).toContain(
        'Not checked: python (1 .py file). Run gspot add <name>, or gspot remove <name> --reason "<why>".',
    );
    expect(text.stdout.match(/Not checked:/gu)).toHaveLength(1);
    const removed = await runGspot(sandbox.path, ['remove', 'python', '--reason', 'External tooling checks Python.']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const after = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    expect(after.code, after.stdout + after.stderr).toBe(0);
    expect(after.report).not.toHaveProperty('notChecked');
});
