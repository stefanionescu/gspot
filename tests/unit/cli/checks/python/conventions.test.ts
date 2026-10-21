import { join } from 'node:path';
import { testdir } from 'testdirs';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';
import { CLEAN_PYTHON_MODULE, PYTHON_MODULE_CASES, PYTHON_MODULE_SANDBOX } from '#tests/data/checks/python/modules.ts';

test.each([...PYTHON_MODULE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const plan = {
        ...PYTHON_MODULE_SANDBOX,
        cleanSource: CLEAN_PYTHON_MODULE,
    };
    await using sandbox = await createSandbox(plan);
    const result = await runCheckSample(sandbox, entry, plan);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});

test.each([...LOCKFILES.filter(({ packageManager }) => ['uv', 'poetry', 'pdm'].includes(packageManager))])(
    'pip-installs reports a requirements file only in a locked scope ($file) and passes once it is removed',
    async ({ file }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['python'], {
                level: 'all',
                scopes: [
                    { path: 'locked', configurations: ['python'] },
                    { path: 'other', configurations: ['python'] },
                ],
            }),
            'requirements.txt': 'root-dependency\n',
            [`locked/${file}`]: 'version = 1\n',
            'locked/requirements.txt': 'duplicated-dependency\n',
            'locked/main.py': 'value = 1\n',
            'other/requirements.txt': 'unlocked-dependency\n',
            'other/main.py': 'value = 2\n',
        });

        const checked = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['python/pip-installs'] }),
        );

        const report = checked.report;
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            { file: 'locked/requirements.txt', rule: 'requirements-file' },
        ]);
        expect(report.checks.filter((check) => check.status === 'failed').map((check) => check.scope)).toStrictEqual([
            'locked',
        ]);
        await rm(join(sandbox.path, 'locked/requirements.txt'));
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['python/pip-installs'] }),
        );

        expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);

test('function-size reports a Python function over limits.python.function_lines, counting code lines only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[limits.python]\nfunction_lines = 3\n',
        }),
        'main.py':
            'def short():\n    # A comment.\n\n    return 1\n\n\ndef long(value):\n    first = value\n    second = first\n    return second\n',
    });
    const findings = await checkFindings(sandbox.path, 'python/function-size');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        { line: 7, rule: 'function-lines', message: 'long has 4 code lines, over the limit of 3.' },
    ]);
});
