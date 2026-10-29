import { testdir } from 'testdirs';
import { join, basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

test('commits/commitlint-pushed checks each pushed commit with the commitlint command and names the commit in each finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
        'package.json': '{"private":true,"devDependencies":{"@commitlint/cli":"21.2.3"}}',
    });
    const first = commitAll(sandbox.path, 'first broken message');
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'second broken message']);
    const second = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await applyGeneratedFiles(sandbox.path);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const spawn = processes.spawnProcess;
    const commands: string[][] = [];
    using _record = spyOn(processes, 'spawnProcess').mockImplementation(async (command, options) => {
        if (command.some((value) => basename(value) === 'commitlint')) commands.push([...command]);
        return await spawn(command, options);
    });
    const session = await openSession(sandbox.path);
    const selected = planSandboxCheck(session, 'commits/commitlint-pushed');
    const planned = { ...selected, tool: { ...selected.tool!, system: true }, commits: [first, second] };
    const result = await runCheckCode(buildCheckSession(session), planned, CHECK_CODE[planned.check.id]);
    expect(result.status, JSON.stringify(result)).toBe('failed');
    expect(result.note).toBe('Checked 2 commit messages.');
    expect(commands.map((command) => [basename(command[0]!), command[1], command[3]])).toStrictEqual([
        ['commitlint', '--config', '--edit'],
        ['commitlint', '--config', '--edit'],
    ]);
    expect(new Set(commands.map((command) => command[4])).size).toBe(2);
    expect(result.findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual(
        [first, second].flatMap((commit) => [
            { rule: 'type-empty', message: `${commit}: type may not be empty` },
            { rule: 'subject-empty', message: `${commit}: subject may not be empty` },
        ]),
    );
});
