import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { runCommandBatches, runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { BATCH_CHECK, BATCH_FINDINGS, BATCH_IGNORE } from '#tests/config/engine/tool-runs.ts';
import { buildRunOptions, CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.skipIf(isWindows)('a command check whose program lost its execute bit errors with exit code 2', async () => {
    await using sandbox = await createGitSandbox({});
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/checker',
                        output: { format: 'none' },
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [executable],
                    },
                ],
            }),
        }),
        'source.txt': 'input\n',
    });
    await writeProgramCommand(sandbox.path, 'checker', 'fakes/tool');
    await chmod(executable, 0o644);
    const options = buildRunOptions({ stage: 'commit', only: ['project/checker'] });
    const unexecutable = await runChecks(await openSession(sandbox.path), options);
    expect(unexecutable.report.exitCode).toBe(2);
    expect(unexecutable.report.checks.map(({ status }) => status)).toStrictEqual(['error']);
    expect(unexecutable.report.checks[0]?.note).toContain('checker could not run');
    expect(unexecutable.report.checks[0]?.note).not.toContain(sandbox.path);
    expect(unexecutable.report.checks[0]?.note).toContain('EACCES');
});

test.skipIf(isWindows)('a per-file process killed by a signal is an error, not a finding', async () => {
    const command = buildProgramCommand('fakes/tool', '--signal', 'SIGTERM', '{file}');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/termination', command, paths: ['source.txt'], stage: 'commit' }],
            }),
        }),
        'source.txt': 'valid source',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['project/termination'] });
    const planned = plans[0]!;
    const failed = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});

test('a fatal command group stops before the next group runs', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.js': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['format/prettier'] })[0]!;
    planned.tool = { name: process.execPath, kind: 'program', installers: {} };
    planned.check = { ...planned.check, output: { format: 'none' }, exit_codes: [1] };
    const commands: string[][] = [];
    using _commands = fakeCommands(process.execPath, (command) => {
        commands.push([...command]);
        return Promise.resolve(buildProcessResult({ code: 2, stderr: 'Cannot read configuration.' }));
    });
    const result = await runCommandBatches(buildCheckSession(session, CHECK_GENERATION), planned, [
        { files: planned.files, command: [process.execPath, 'first'] },
        { files: planned.files, command: [process.execPath, 'second'] },
    ]);
    expect(result.status).toBe('error');
    expect(commands).toStrictEqual([[process.execPath, 'first']]);
});

test.each(['crash'] as const)('a later %s preserves only selected, unignored findings', async () => {
    const command = buildProgramCommand('fakes/tool', '{file}');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [{ ...BATCH_CHECK, command }] }) }),
        'one.txt': 'one',
        'two.txt': 'two',
        'outside.txt': 'outside',
    });
    const failed = { code: 2, stderr: 'Fatal failure.' };
    using _commands = fakeCommands(process.execPath, (command) =>
        Promise.resolve(
            buildProcessResult(
                command.at(-1) === 'one.txt' ? { code: 1, stdout: JSON.stringify(BATCH_FINDINGS) } : failed,
            ),
        ),
    );
    const session = await openSession(sandbox.path);
    const paths = ['one.txt', 'two.txt'];
    const options = buildRunOptions({ cwd: sandbox.path, only: ['project/batches'], paths, pathArguments: paths });
    const result = await runChecks(session, options);
    expect(
        result.report.checks.map(({ status, findings }) => ({
            status,
            findings: findings.map(({ file, rule, message }) => ({ file, rule, message })),
        })),
    ).toStrictEqual([{ status: 'error', findings: [{ file: 'one.txt', rule: 'kept', message: 'Kept finding.' }] }]);
    session.settings.ignore.push(BATCH_IGNORE);
    const ignored = await runChecks(session, options);
    expect(ignored.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'error', findings: [] },
    ]);
});
