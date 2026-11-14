import { join } from 'node:path';
import { testdir } from 'testdirs';
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

test.each([{ isAbsolute: false }, { isAbsolute: true }])(
    'a failed commit-msg check prints its rerun line from the current folder, when the absolute path is $isAbsolute',
    async ({ isAbsolute }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['commits']),
            'notes/message.txt': 'fix(cli): retain the argument of C3-BUG-019\n',
        });
        runGitStep(sandbox.path, ['add', 'gspot.toml']);
        const folder = join(sandbox.path, 'notes');
        const result = await runGspot(folder, [
            'check',
            '--hook',
            'commit-msg',
            '--only',
            'commits/references',
            '--',
            isAbsolute ? join(folder, 'message.txt') : 'message.txt',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toContain('--hook commit-msg -- message.txt\n');
        expect(result.stdout).not.toContain(sandbox.path);
    },
);

test('a failed commit-msg check in a linked worktree prints no absolute path', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['commits']) });
    await using folder = await testdir();
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    runGitStep(sandbox.path, ['commit', '-m', 'test: add settings']);
    const linked = join(folder.path, 'linked');
    runGitStep(sandbox.path, ['worktree', 'add', '-b', 'linked', linked]);
    const message = join(sandbox.path, '.git/worktrees/linked/COMMIT_EDITMSG');
    await writeFile(message, 'fix(cli): retain the argument of C3-BUG-019\n');
    const result = await runGspot(linked, [
        'check',
        '--hook',
        'commit-msg',
        '--only',
        'commits/references',
        '--',
        message,
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('.git/worktrees/linked/COMMIT_EDITMSG\n');
    expect(result.stdout).not.toContain(sandbox.path);
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
