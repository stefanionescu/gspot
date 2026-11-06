import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

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

test('a failed commit-msg check prints its rerun line with the message file as typed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits']),
        'notes/message.txt': 'fix(cli): retain the argument of C3-BUG-019\n',
    });
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    const result = await runGspot(join(sandbox.path, 'notes'), [
        'check',
        '--hook',
        'commit-msg',
        '--only',
        'commits/references',
        '--',
        'message.txt',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('--hook commit-msg -- message.txt');
    expect(result.stdout).not.toContain(sandbox.path);
});

test('the rerun line prints the absolute path of the commit-msg hook relative to the current folder', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits']),
        'notes/message.txt': 'fix(cli): retain the argument of C3-BUG-019\n',
    });
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    const result = await runGspot(join(sandbox.path, 'notes'), [
        'check',
        '--hook',
        'commit-msg',
        '--only',
        'commits/references',
        '--',
        join(sandbox.path, 'notes/message.txt'),
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('--hook commit-msg -- message.txt\n');
});

test('an unreadable commit message file is named as typed', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['commits']) });
    const result = await runGspot(sandbox.path, ['check', '--hook', 'commit-msg', '--json', '--', 'gone.txt']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'filesystem',
        message: 'gspot cannot read the commit message file gone.txt.',
    });
});
