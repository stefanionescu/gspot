import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { HOOKS_SETTINGS, BASH_SYNTAX_PUSH_CHECK } from '#tests/config/setup/sandboxes.ts';

test('check names a package.json that does not parse, which gives the run no dependencies', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/web' }] }),
        'packages/web/package.json': '{"dependencies":{"react":19}}',
    });
    const result = await runGspot(sandbox.path, ['check', '--json']);
    expect((JSON.parse(result.stdout) as { notes: string[] }).notes).toContain(
        'packages/web/package.json does not parse, so gspot read no dependencies from it.',
    );
});

test('check warns once for missing hooks, skips the warning for pre-push, and stops warning once the hooks run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: `${HOOKS_SETTINGS}${BASH_SYNTAX_PUSH_CHECK}` }),
        'source.txt': 'valid text\n',
    });
    const head = commitAll(sandbox.path);
    const before = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(before.stderr).toStartWith('[warn] The Git hooks are not installed in this clone. Run gspot install.\n');
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
    expect(missing.stderr).toStartWith(
        '[warn] .gspot/hooks/pre-commit is missing, so Git skips the pre-commit checks. Run gspot apply.\n',
    );
    await applyGeneratedFiles(sandbox.path);
    const installed = await runGspot(sandbox.path, ['check', '--only', 'repository/encoding']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stderr).toBe('');
});
