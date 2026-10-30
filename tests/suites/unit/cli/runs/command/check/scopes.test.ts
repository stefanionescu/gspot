import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/bash.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { SWIFT_VALUE_SOURCE } from '#tests/config/swift.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';
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
    using _pins = fakeToolExecutables([getTool(session.configurationsByName.values(), 'swiftlint')]);
    const calls: { cwd: string; files: string[] }[] = [];
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        calls.push({ cwd: options.cwd, files: command.filter((argument) => argument.endsWith('.swift')) });
        return Promise.resolve(buildProcessResult({ stdout: '[]' }));
    });
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.scope.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        check.check = { ...check.check, runs: 'scope' };
        expect(await runCommandCheck(buildCheckSession(session), check)).toMatchObject({ status: 'passed' });
    }
    expect(calls).toStrictEqual([
        { cwd: sandbox.path, files: ['./--config=x.swift'] },
        { cwd: join(sandbox.path, scope), files: ['./--config=x.swift'] },
    ]);
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
