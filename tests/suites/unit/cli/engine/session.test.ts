import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { SESSION_FILES } from '#tests/config/engine/tool-runs.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a run uses the cancel signal supplied when its session opens', async () => {
    await using sandbox = await createGitSandbox({
        ...SESSION_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { rules: true }),
    });
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources, cancelSignal: AbortSignal.abort() });
    const result = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual([
        { check: 'naming/identifiers', status: 'canceled', findings: [] },
    ]);
});
