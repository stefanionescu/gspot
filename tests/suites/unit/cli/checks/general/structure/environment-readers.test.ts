import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    OS_VALUE_SOURCE,
    PYTHON_ENVIRONMENT_SOURCE,
    BASH_ENVIRONMENT_READ_CASES,
} from '#tests/config/checks/general/structure/environment-readers.ts';

test('Swift environment reads outside the env files are reported; comments and strings are not', async () => {
    await using sandbox = await testdir({
        'Sources/Screen.swift': `let live = ProcessInfo.processInfo.environment["KEY"]
// ProcessInfo.processInfo.environment
let literal = "ProcessInfo.processInfo.environment"
let spaced = ProcessInfo . processInfo . environment
`,
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
    });
    const initial = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/environment-readers'] }),
    );
    expect(initial.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'skipped', findings: [] },
    ]);
    await writeFile(
        `${sandbox.path}/gspot.toml`,
        buildSandboxSettings(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = { value = ["Sources/Environment.swift"], reason = "These paths own environment access for this project." }\n',
        }),
    );
    const result = await runSandboxCheck(sandbox.path, 'structure/environment-readers');
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-reader' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-reader' },
    ]);
    await writeFile(
        `${sandbox.path}/gspot.toml`,
        buildSandboxSettings(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = { value = ["Sources/Screen.swift"], reason = "These paths own environment access for this project." }\n',
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/environment-readers')).toStrictEqual([]);
});

test('Python reads through os aliases are reported; shadowed and unrelated names are not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = { value = ["environment.py"], reason = "These paths own environment access for this project." }\n',
        }),
        'environment.py': OS_VALUE_SOURCE,
        'main.py': PYTHON_ENVIRONMENT_SOURCE,
    });
    const initial = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/environment-readers'] }),
    );
    expect(listFindingRows(initial.report)).toStrictEqual(
        [3, 4, 5, 6].map((line) => ({ file: 'main.py', line, rule: 'read-outside-reader' })),
    );

    await writeFile(
        `${sandbox.path}/main.py`,
        'from unrelated import environ, getenv\nfirst = environ["KEY"]\nsecond = getenv("KEY")\n',
    );
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/environment-readers'] }),
    );

    expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('each scope uses its own environment readers', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['python'] }],
            tables: '[structure]\nenvironment_readers = { value = ["environment.py"], reason = "These paths own environment access for this project." }\n[scope.structure]\nenvironment_readers = { value = ["app/environment.py"], reason = "These paths own environment access for this project." }\n',
        }),
        'environment.py': OS_VALUE_SOURCE,
        'main.py': OS_VALUE_SOURCE,
        'app/environment.py': 'import os\nVALUE = os.getenv("KEY")\n',
        'app/main.py': 'from os import getenv as read\nVALUE = read("KEY")\n',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/environment-readers'] }),
    );
    expect(
        result.report.checks.flatMap(({ findings }) => findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([
        { file: 'main.py', line: 2 },
        { file: 'app/main.py', line: 2 },
    ]);
});

test.each([...BASH_ENVIRONMENT_READ_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);
