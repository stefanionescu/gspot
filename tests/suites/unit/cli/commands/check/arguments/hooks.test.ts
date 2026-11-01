import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the commit-msg selector keeps the message stage and reads the file after --', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits']),
        'message.txt': 'fix(cli): retain the message argument\n',
    });
    const result = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--hook',
            'commit-msg',
            '--only',
            'commits/references',
            '--json',
            '--',
            'message.txt',
        ]),
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.stage).toBe('message');
    expect(result.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'commits/references', status: 'passed' },
    ]);
});
