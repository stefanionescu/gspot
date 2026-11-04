import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { NODE_SCRIPT } from '#tests/config/setup/languages.ts';
import { SESSION_FILES } from '#tests/config/engine/tool-runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';

test('a copied session generates settings from its replacement inventory and run cache', async () => {
    await using sandbox = await createGitSandbox({
        ...SESSION_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { rules: true }),
    });
    const opened = await openSession(sandbox.path);
    const previous = buildConfigs(opened);
    await writeFile(join(sandbox.path, 'run'), NODE_SCRIPT);
    const fresh = await openSession(sandbox.path);
    const copied = { ...opened, cache: fresh.cache, repository: fresh.repository, scopes: fresh.scopes };
    const generated = buildConfigs(copied);
    expect(generated.files).not.toStrictEqual(previous.files);
    expect(generated.files).toStrictEqual(buildConfigs(fresh).files);
});

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
