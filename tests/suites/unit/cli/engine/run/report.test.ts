import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a check that one scope runs and another skips does not count as skipped', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'app' }] }),
        'README.md': '# Readme\n',
        'app/source.ts': 'export const value = 1;\n',
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['markdown/fences'], verbose: true }),
    );
    expect(report.checks.map(({ scope, status }) => [scope, status])).toStrictEqual([
        ['', 'passed'],
        ['app', 'skipped'],
    ]);
    expect(report.skippedCount).toStrictEqual({});
});

test('a check that every scope skips counts once', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'app' }] }),
        'source.ts': 'export const value = 1;\n',
        'app/source.ts': 'export const value = 1;\n',
    });
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['markdown/fences'] }));
    expect(report.skippedCount).toStrictEqual({ 'no-files': 1 });
});

test('a run names a package.json that does not parse, which gives the run no dependencies', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/web' }] }),
        'packages/web/package.json': '{"dependencies":{"react":19}}',
    });
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({}));
    expect(report.notes).toContain('packages/web/package.json does not parse, so gspot read no dependencies from it.');
});
