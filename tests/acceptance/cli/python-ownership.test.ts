import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/planted.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { reportSchema } from '#cli/run/report-schema.ts';

test('Python dependency ownership applies only to locked scopes and accepts removal of the duplicate list', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\npresets = ["python"]\n[[scope]]\npath = "locked"\npresets = ["python"]\n[[scope]]\npath = "other"\npresets = ["python"]\n',
        '.gspot/version': `${GSPOT_VERSION}\n`,
        'requirements.txt': 'root-dependency\n',
        'locked/uv.lock': 'version = 1\n',
        'locked/requirements.txt': 'duplicated-dependency\n',
        'locked/main.py': 'value = 1\n',
        'other/requirements.txt': 'unlocked-dependency\n',
        'other/main.py': 'value = 2\n',
    });
    const command = ['check', '--only', 'integrity/dependency-ownership', '--json', '--no-cache'];
    const checked = await run(sandbox.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(checked.stdout));
    expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: 'locked/requirements.txt', rule: 'requirements-file' },
    ]);
    expect(report.checks.filter((check) => check.status === 'fail').map((check) => check.scope)).toEqual(['locked']);
    rmSync(join(sandbox.path, 'locked/requirements.txt'));
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks.flatMap((check) => check.findings)).toEqual([]);
});

test('absent Python import contracts are explicit skips and malformed project files are errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["python"]\n',
        '.gspot/version': `${GSPOT_VERSION}\n`,
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json', '--no-cache'];
    const absent = await run(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(absent.stdout)).checks).toMatchObject([
        {
            check: 'python/import-linter',
            status: 'skipped',
            note: 'This scope has no tool.importlinter configuration.',
        },
    ]);
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[broken');
    const malformed = await run(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect(reportSchema.parse(JSON.parse(malformed.stdout)).checks).toMatchObject([
        { check: 'python/import-linter', status: 'error' },
    ]);
});
