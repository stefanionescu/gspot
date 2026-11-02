import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the commit-msg selector keeps the message stage, reads the file after --, and reads the staged settings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits']),
        'message.txt': 'fix(cli): retain the message argument\n',
    });
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    await writeFile(join(sandbox.path, 'gspot.toml'), 'this edit is not TOML');
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
    expect(result.report.stages).toStrictEqual(['message']);
    expect(result.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'commits/references', status: 'passed' },
    ]);
});
