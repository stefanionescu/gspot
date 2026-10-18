import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { markExecutable } from '#tests/setup/git.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { BASH_SANDBOX, CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    BASH_ENV_READ_CASES,
    SWIFT_ENVIRONMENT_SOURCE,
    PYTHON_ENVIRONMENT_SOURCE,
} from '#tests/data/checks/structure/environment-readers.ts';

test('Swift environment reads outside the env files are reported; comments and strings are not', async () => {
    await using sandbox = await testdir({
        'Sources/Screen.swift': SWIFT_ENVIRONMENT_SOURCE,
        'gspot.toml': buildSettingsText(['swift'], { level: 'all' }),
    });
    expect(await checkFindings(sandbox.path, 'structure/environment-readers')).toStrictEqual([]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["Sources/Environment.swift"]\n',
        }),
    );
    const result = await checkFindings(sandbox.path, 'structure/environment-readers');
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-owner' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-owner' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["Sources/Screen.swift"]\n',
        }),
    );
    expect(await checkFindings(sandbox.path, 'structure/environment-readers')).toStrictEqual([]);
});

test('Python reads through os aliases are reported; shadowed and unrelated names are not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['python'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["environment.py"]\n',
        }),
        'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'main.py': PYTHON_ENVIRONMENT_SOURCE,
    });
    const initial = await checkReport(sandbox.path, ['check', '--only', 'structure/environment-readers', '--json']);
    const checks = initial.report.checks;
    expect(
        checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([3, 4, 5, 6].map((line) => ({ file: 'main.py', line, rule: 'read-outside-owner' })));
    expect(initial.code).toBe(1);
    await Bun.write(
        `${sandbox.path}/main.py`,
        'from unrelated import environ, getenv\nfirst = environ["KEY"]\nsecond = getenv("KEY")\n',
    );
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'structure/environment-readers', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('each scope uses its own env files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['python'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["environment.py"]\n[[scope]]\npath = "app"\nconfigurations = ["python"]\n[scope.structure]\nenvironment_readers = ["app/environment.py"]\n',
        }),
        'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'main.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'app/environment.py': 'import os\nVALUE = os.getenv("KEY")\n',
        'app/main.py': 'from os import getenv as read\nVALUE = read("KEY")\n',
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'structure/environment-readers', '--json']);
    expect(
        result.report.checks.flatMap(({ findings }) => findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([
        { file: 'main.py', line: 2 },
        { file: 'app/main.py', line: 2 },
    ]);
    expect(result.code).toBe(1);
});

test.each([...BASH_ENV_READ_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const plan = {
        ...BASH_SANDBOX,
        corrected: (row: { files: Readonly<Record<string, string>> }) => ({
            files: Object.fromEntries(Object.keys(row.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
        }),
    };
    await using sandbox = await createSandbox(plan);
    await markExecutable(sandbox.root, 'scripts/build.sh');
    const result = await runCheckSample(sandbox, entry, plan);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
