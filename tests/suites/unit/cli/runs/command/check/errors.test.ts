import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';

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
});

test('per-file failures name the selected file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/file-result',
                        command: buildProgramCommand('checks/search', '--text', 'invalid', '{file}'),
                        paths: ['inputs/**'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'inputs/café source.txt': 'invalid',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['project/file-result'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(buildCheckSession(session), planned);
    expect(failed.status).toBe('failed');
    expect(failed.findings.map((finding) => finding.file)).toStrictEqual(['inputs/café source.txt']);
});

test.skipIf(isWindows)('a per-file process killed by a signal is an error, not a finding', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/termination',
                        command: buildProgramCommand('fakes/tool', '--signal', 'SIGTERM', '{file}'),
                        paths: ['source.txt'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'source.txt': 'valid source',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['project/termination'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(buildCheckSession(session), planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});

test('a command check whose config file is missing errors before it runs and names gspot apply', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['format/prettier'] })[0]!;
    const command = ['prettier', '--config', '{config_file:prettier}', '{files}'];
    const result = await runCheckCommand(buildCheckSession(session), {
        ...planned,
        check: { ...planned.check, command },
    });
    expect(result).toMatchObject({
        status: 'error',
        note: 'The config file .gspot/configurations/general/format/prettier.json is missing. Run gspot apply.',
        findings: [],
    });
});

test.each(['python/basedpyright', 'pytest/coverage'])(
    '%s asks for the project environment before running the tool',
    async (check) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['python', 'pytest']),
            'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
            'test_main.py': 'from app import count\n',
        });
        const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));
        expect(result.report.exitCode).toBe(2);
        expect(result.report.checks).toMatchObject([
            {
                status: 'missing',
                findings: [],
                note: 'The project environment .venv is missing. Run uv sync, then check again.',
            },
        ]);
    },
);
