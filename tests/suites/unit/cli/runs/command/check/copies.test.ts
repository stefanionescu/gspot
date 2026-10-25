import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildCheckSession } from '#cli/commands/check/run.ts';
import { UV_PROJECT_ENVIRONMENT } from '#cli/config/tools/uv.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runCheckCommand, buildCommandSetup } from '#cli/runs/command/check.ts';
import { writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

test('a Python check that runs in a copy uses the environment that the working tree installed', async () => {
    await using working = await createGitSandbox({});
    await using sandbox = await createGitSandbox({});
    const files = {
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\nrequires-python = ">=3.12"\n',
        'uv.lock': 'version = 1\n',
        'app/main.py': 'import requests\n',
    };
    await createFileTree(working.path, { ...files, '.venv/pyvenv.cfg': 'home = /usr/bin\n' });
    await createFileTree(sandbox.path, files);
    const session = await openSession(sandbox.path, { installedRoot: working.path });
    const planned = planChecks(session, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.id === 'python/basedpyright',
    )!;
    expect(buildCommandSetup(session, planned, { options: {}, root: session.root }).env[UV_PROJECT_ENVIRONMENT]).toBe(
        join(working.path, '.venv'),
    );
    const inPlace = await openSession(working.path);
    const local = planChecks(inPlace, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.id === 'python/basedpyright',
    )!;
    expect(buildCommandSetup(inPlace, local, { options: {}, root: inPlace.root }).env).not.toHaveProperty(
        'UV_PROJECT_ENVIRONMENT',
    );
});

test('a command run in a copy finds the other tools beside its program before a PATH entry', async () => {
    await using sandbox = await createGitSandbox({});
    const files = {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/companion',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [join(sandbox.path, 'native/checker')],
                    },
                ],
            }),
        }),
        'source.txt': '',
        'copy/.keep': '',
    };
    await createFileTree(sandbox.path, files);
    await writeProgramCommand(sandbox.path, 'native/checker', 'processes/command', 'shellcheck', '--version');
    await writeProgramCommand(sandbox.path, 'native/shellcheck', 'fakes/tool', '--line', 'ShellCheck version: 0.11.0');
    await writeProgramCommand(sandbox.path, 'inactive/shellcheck', 'fakes/tool', '--exit', '7');
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['project/companion'] })[0]!;
    using _environment = overrideEnvironment({ PATH: join(sandbox.path, 'inactive') });
    using _which = fakeExecutableLookup(join(sandbox.path, `native/shellcheck${isWindows ? '.cmd' : ''}`));

    const result = await runCheckCommand(buildCheckSession(session), planned, { copyRoot: join(sandbox.path, 'copy') });
    expect(result.status, result.note).toBe('passed');
    expect(result.findings).toStrictEqual([]);
});
