import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildCommandEnvironment } from '#cli/runs/command/check.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { PENDING_NOTES_SCRIPT } from '#tests/data/runs/command-checks.ts';

test('a command check runs its command and reports file and line through its output format', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: String.raw`[[command_check]]
name = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING_NOTES_SCRIPT, '{files}'])}
paths = ["notes/**"]
stage = "commit"
summary = "Finds pending notes left in the notes folder."

[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/plan.txt': 'one\nPENDING later\n',
    });

    const check = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']));
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect(check.report.checks).toMatchObject([
        {
            check: 'notes/no-pending',
            status: 'failed',
            findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
        },
    ]);
});

test('a Python check of a scratch copy reads the environment that the working tree installed', async () => {
    await using working = await testdir();
    await using scratch = await testdir();
    const files = {
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\nrequires-python = ">=3.12"\n',
        'uv.lock': 'version = 1\n',
        'app/main.py': 'import requests\n',
    };
    await createFileTree(working.path, { ...files, '.venv/pyvenv.cfg': 'home = /usr/bin\n' });
    await createFileTree(scratch.path, files);
    const session = await openSession(scratch.path, { installedRoot: working.path });
    const planned = planRun(session, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.name === 'python/basedpyright',
    )!;
    expect(buildCommandEnvironment(session, planned, {}).env['UV_PROJECT_ENVIRONMENT']).toBe(
        join(working.path, '.venv'),
    );
    const inPlace = await openSession(working.path);
    const local = planRun(inPlace, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.name === 'python/basedpyright',
    )!;
    expect(buildCommandEnvironment(inPlace, local, {}).env).not.toHaveProperty('UV_PROJECT_ENVIRONMENT');
});
