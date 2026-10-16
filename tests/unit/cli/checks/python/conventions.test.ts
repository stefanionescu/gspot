import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { CLEAN_PYTHON_MODULE, PYTHON_MODULE_CASES, PYTHON_MODULE_SANDBOX } from '#tests/data/checks/python/modules.ts';

describe('modules', () => {
    test.each([...PYTHON_MODULE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
        const plan = {
            ...PYTHON_MODULE_SANDBOX,
            corrected: (row: { files: Readonly<Record<string, string>> }) => ({
                files: Object.fromEntries(Object.keys(row.files).map((path) => [path, CLEAN_PYTHON_MODULE])),
            }),
        };
        await using sandbox = await createSandbox(plan);
        const result = await runCheckSample(sandbox, entry, plan);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
});
describe('pip-installs', () => {
    test.each([...LOCKFILES.filter(({ packageManager }) => ['uv', 'poetry', 'pdm'].includes(packageManager))])(
        'pip-installs reports a requirements file only in a locked scope ($file) and passes once it is removed',
        async ({ file }) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': buildSettingsText(['python'], {
                    tables: '[[scope]]\npath = "locked"\nconfigurations = ["python"]\n[[scope]]\npath = "other"\nconfigurations = ["python"]\n',
                    level: 'all',
                }),
                'requirements.txt': 'root-dependency\n',
                [`locked/${file}`]: 'version = 1\n',
                'locked/requirements.txt': 'duplicated-dependency\n',
                'locked/main.py': 'value = 1\n',
                'other/requirements.txt': 'unlocked-dependency\n',
                'other/main.py': 'value = 2\n',
            });
            const command = ['check', '--only', 'python/pip-installs', '--json'];
            const checked = await checkReport(sandbox.path, command);
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            const report = checked.report;
            expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
                { file: 'locked/requirements.txt', rule: 'requirements-file' },
            ]);
            expect(
                report.checks.filter((check) => check.status === 'failed').map((check) => check.scope),
            ).toStrictEqual(['locked']);
            await rm(join(sandbox.path, 'locked/requirements.txt'));
            const corrected = await checkReport(sandbox.path, command);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
        },
    );
});
