import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { fakeNpmTool } from '#tests/setup/cli/tools.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildCheckSession } from '#cli/engine/run/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandCheck } from '#cli/engine/run/tool-runs/check.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { UV_PROJECT_ENVIRONMENT } from '#cli/config/tools/installers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readCallRecords, buildProgramCommand } from '#tests/setup/system/programs.ts';

const PYVENV_HOME = 'home = /usr/bin\n';

test('a Python check that runs in a copy uses the environment that the working tree installed', async () => {
    await using working = await createGitSandbox({});
    await using sandbox = await createGitSandbox({});
    const files = {
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\nrequires-python = ">=3.12"\n',
        'uv.lock': 'version = 1\n',
        'app/main.py': 'import requests\n',
    };
    await createFileTree(working.path, { ...files, '.venv/pyvenv.cfg': PYVENV_HOME });
    await fakeNpmTool(working.path, 'basedpyright');
    await createFileTree(sandbox.path, files);
    const copy = await openSession(sandbox.path, { toolsRoot: working.path });
    const calls: Array<{ pythonPath: string | undefined; environment: string | undefined }> = [];
    using _spawn = fakeCommands().mockImplementation((command, options) => {
        const flag = command.indexOf('--pythonpath');
        calls.push({
            pythonPath: flag === -1 ? undefined : command[flag + 1],
            environment: options.env?.[UV_PROJECT_ENVIRONMENT],
        });
        return Promise.resolve(buildProcessResult({ stdout: '{"generalDiagnostics":[]}' }));
    });
    for (const session of [copy, await openSession(working.path)]) {
        const planned = planChecks(session, buildRunOptions({ only: ['python/basedpyright'] })).find(
            ({ check }) => check.id === 'python/basedpyright',
        )!;
        expect(await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned)).toMatchObject({
            status: 'passed',
        });
    }
    expect(calls).toStrictEqual([
        {
            pythonPath: join(working.path, isWindows ? '.venv/Scripts/python.exe' : '.venv/bin/python'),
            environment: join(working.path, '.venv'),
        },
        { pythonPath: undefined, environment: undefined },
    ]);
});

test('a command check that runs in a copy reports repository paths', async () => {
    await using sandbox = await createGitSandbox({});
    const trace = join(sandbox.path, 'calls.log');
    const check = {
        id: 'project/copied',
        stage: 'commit',
        paths: ['source.txt'],
        command: buildProgramCommand('fakes/tool', '--record', trace, '--', '{files}'),
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [check] }) }),
        'source.txt': 'input\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['project/copied'] })[0]!;
    planned.check = { ...planned.check, run_in_copy: true };
    const result = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(result.status, result.note).toBe('passed');
    const [call] = await readCallRecords(trace);
    expect(call?.cwd).toContain('.gspot-copies');
    expect(call?.arguments).toStrictEqual(['source.txt']);
    expect(result.command?.filter((argument) => argument.includes('.gspot-copies'))).toStrictEqual([]);
});
