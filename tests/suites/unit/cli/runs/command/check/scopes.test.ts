import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/bash.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/swift.ts';
import { buildCommandSetup } from '#cli/runs/command/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { CHILD_SCOPE_SETTINGS } from '#tests/config/runs/command/check.ts';

test('a command in a scope runs in the scope folder with paths relative to it', async () => {
    await using sandbox = await createGitSandbox({});
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: scope }] }),
        '--config=x.swift': SWIFT_VALUE_SOURCE,
        [`${scope}/--config=x.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.scope.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        check.check = { ...check.check, runs: 'scope' };
        const setup = buildCommandSetup(session, check, { options: {}, root: session.root });
        expect(setup.cwd).toBe(join(sandbox.path, check.scope.path));
        expect(setup.files).toStrictEqual(['./--config=x.swift']);
        expect(setup.substitutions.files).toStrictEqual(['./--config=x.swift']);
    }
});

test('a command check at the root checks a changed file of a child scope once', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], CHILD_SCOPE_SETTINGS),
        'api/source.sh': BROKEN_IF_SCRIPT,
        'web/source.sh': 'echo sibling\n',
    });

    const options = buildRunOptions({
        stage: 'push',
        only: ['project/syntax'],
        changed: ['api/source.sh'],
    });
    const failed = await runChecks(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
});
