import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import packageManifest from '#cli-package' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

test('Python dependency ownership applies only to locked scopes and accepts removal of the duplicate list', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["python"]\n[[scope]]\npath = "locked"\nconfigurations = ["python"]\n[[scope]]\npath = "other"\nconfigurations = ["python"]\n',
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
    expect(report.checks.filter((check) => check.status === 'fail').map((check) => check.scope)).toStrictEqual([
        'locked',
    ]);
    rmSync(join(sandbox.path, 'locked/requirements.txt'));
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks.flatMap((check) => check.findings)).toStrictEqual(
        [],
    );
});

test('absent Python import contracts are explicit skips and malformed project files are errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["python"]\n',
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
