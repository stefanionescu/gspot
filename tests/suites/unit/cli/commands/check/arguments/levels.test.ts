import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
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
    expect(checked.report.checks[0]?.findings.length).toBeGreaterThan(0);
    const note = 'docs/required-files: --only allows this check to run here; it stays off in hooks at level basic.';
    expect(checked.report.notes).toContain(note);
    const text = await runGspot(sandbox.path, ['check', '--only', 'docs/required-files']);
    expect(text.stdout).toContain(note);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'commit' }).some(({ check }) => check.id === 'docs/required-files')).toBe(
        false,
    );
});

test('--only keeps an explicit ignore even when it overrides the level', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            ignore: { checks: ['docs/required-files'], reason: 'A separate repository contains our documentation.' },
        }),
    });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        { check: 'docs/required-files', status: 'skipped', cause: 'ignore', findings: [] },
    ]);
});
