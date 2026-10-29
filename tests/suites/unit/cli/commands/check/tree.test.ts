import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { installHooks } from '#cli/installers/hooks.ts';
import { HOOKS_SETTINGS } from '#tests/config/hooks.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('check warns once for missing hooks, skips the warning for pre-push, and stops warning after installation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'source.txt': 'valid text\n',
    });
    const head = commitAll(sandbox.path);
    const before = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stderr).toBe('[warn] The Git hooks are not installed in this clone. Run gspot install.\n');
    const pushed = await runGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'repository/encoding'],
        {},
        {
            stdin: `refs/heads/main ${head} refs/heads/main ${'0'.repeat(head.length)}\n`,
        },
    );
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    expect(pushed.stderr).toBe('');
    installHooks(await openSession(sandbox.path), []);
    const installed = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stderr).toBe('');
});
