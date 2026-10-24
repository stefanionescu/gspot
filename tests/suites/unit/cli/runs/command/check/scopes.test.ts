import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildCommandSetup } from '#cli/runs/command/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CHILD_SCOPE_SETTINGS } from '#tests/config/runs/command.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';

test('a command in a scope runs in the scope folder with paths relative to it', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: scope }] }),
        '--config=x.swift': 'let value = 1\n',
        [`${scope}/--config=x.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.scope.folder.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        const setup = buildCommandSetup(session, check, {});
        expect(setup.cwd).toBe(join(sandbox.path, check.scope.folder.path));
        expect(setup.files).toStrictEqual(['./--config=x.swift']);
        expect(setup.substitutions.files).toStrictEqual(['./--config=x.swift']);
    }
});

test('a command check at the root checks a changed file of a child scope once', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], CHILD_SCOPE_SETTINGS),
        'api/source.sh': 'if then\n',
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
