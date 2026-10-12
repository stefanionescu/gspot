import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { markExecutable } from '#tests/setup/git.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { BASH_ENV_READ_CASES } from '#tests/config/bash/variables.ts';
import { SWIFT_ENVIRONMENT_SOURCE, PYTHON_ENVIRONMENT_SOURCE } from '#tests/config/structure/env-reads.ts';

test('Swift environment reads outside the env files are reported; comments and strings are not', async () => {
    await using sandbox = await testdir({
        'Sources/Screen.swift': SWIFT_ENVIRONMENT_SOURCE,
        'gspot.toml': settingsText(['swift'], { level: 'all' }),
    });
    expect(await checkFindings(sandbox.path, 'structure/env-reads')).toStrictEqual([]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['swift'], {
            level: 'all',
            tables: '[architecture.roles]\nenvironment_readers = ["Sources/Environment.swift"]\n',
        }),
    );
    const result = await checkFindings(sandbox.path, 'structure/env-reads');
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-owner' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-owner' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['swift'], {
            level: 'all',
            tables: '[architecture.roles]\nenvironment_readers = ["Sources/Screen.swift"]\n',
        }),
    );
    expect(await checkFindings(sandbox.path, 'structure/env-reads')).toStrictEqual([]);
});

test('Python reads through os aliases are reported; shadowed and unrelated names are not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], {
            level: 'all',
            tables: '[architecture.roles]\nenvironment_readers = ["environment.py"]\n',
        }),
        'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'main.py': PYTHON_ENVIRONMENT_SOURCE,
    });
    const initial = await checkReport(sandbox.path, ['check', '--only', 'structure/env-reads', '--json']);
    const checks = initial.report.checks;
    expect(
        checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([3, 4, 5, 6].map((line) => ({ file: 'main.py', line, rule: 'read-outside-owner' })));
    expect(initial.code).toBe(1);
    await Bun.write(
        `${sandbox.path}/main.py`,
        'from unrelated import environ, getenv\nfirst = environ["KEY"]\nsecond = getenv("KEY")\n',
    );
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'structure/env-reads', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('each scope uses its own env files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], {
            level: 'all',
            tables: '[architecture.roles]\nenvironment_readers = ["environment.py"]\n[[scope]]\npath = "app"\nconfigurations = ["python"]\n[scope.architecture.roles]\nenvironment_readers = ["app/environment.py"]\n',
        }),
        'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'main.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'app/environment.py': 'import os\nVALUE = os.getenv("KEY")\n',
        'app/main.py': 'from os import getenv as read\nVALUE = read("KEY")\n',
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'structure/env-reads', '--json']);
    expect(
        result.report.checks.flatMap(({ findings }) => findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([
        { file: 'main.py', line: 2 },
        { file: 'app/main.py', line: 2 },
    ]);
    expect(result.code).toBe(1);
});
for (const entry of BASH_ENV_READ_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        const plan = {
            ...BASH_REPOSITORY,
            corrected: (row: { files: Readonly<Record<string, string>> }) => ({
                files: Object.fromEntries(Object.keys(row.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
            }),
        };
        await using sandbox = await createSandbox(plan);
        await markExecutable(sandbox.root, 'scripts/build.sh');
        await runCheckSample(sandbox, entry, plan);
    });
}
