import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { BASH_SYNTAX_PUSH_CHECK, HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('check warns once for missing hooks, skips the warning for pre-push, and stops warning once the hooks run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: `${HOOKS_SETTINGS}${BASH_SYNTAX_PUSH_CHECK}` }),
        'source.txt': 'valid text\n',
    });
    const head = commitAll(sandbox.path);
    const before = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stderr.split('\n').filter((line) => line.startsWith('[warn] '))).toHaveLength(1);
    const pushed = await runGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax'],
        {},
        {
            stdin: `refs/heads/main ${head} refs/heads/main ${'0'.repeat(head.length)}\n`,
        },
    );
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    expect(pushed.stderr).not.toContain('[warn]');
    await installHooks(await openSession(sandbox.path), []);
    const missing = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(missing.stderr).toMatch(/^\[warn\] .*\.gspot\/hooks\/pre-commit/u);
    await applyGeneratedFiles(sandbox.path);
    const installed = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stderr).toBe('');
});

test('--only runs a check that the level turns off and notes that it stays off in hooks', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'docs/required-files', status: 'failed' },
    ]);
    expect(checked.report.notes).toStrictEqual([
        'docs/required-files: --only allows this check to run here; it stays off in hooks at level basic.',
    ]);
});
