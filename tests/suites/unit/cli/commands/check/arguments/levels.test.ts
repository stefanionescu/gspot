import { expect, test } from 'bun:test';

import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('--only runs a stricter check without changing the level or the hook plan and explains the override', async () => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map(({ check, status }) => ({ check, status }))).toEqual([
        { check: 'docs/required-files', status: 'failed' },
    ]);
});
