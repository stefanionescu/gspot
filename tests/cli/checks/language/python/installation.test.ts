import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/runtime.ts';

const { version: RUNNING_VERSION } = packageManifest;

test('Python dependency ownership applies only to locked scopes and accepts removal of the duplicate list', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], {
            tables: '[[scope]]\npath = "locked"\nconfigurations = ["python"]\n[[scope]]\npath = "other"\nconfigurations = ["python"]\n',
            level: 'all',
        }),
        '.gspot/version': `${RUNNING_VERSION}\n`,
        'requirements.txt': 'root-dependency\n',
        'locked/uv.lock': 'version = 1\n',
        'locked/requirements.txt': 'duplicated-dependency\n',
        'locked/main.py': 'value = 1\n',
        'other/requirements.txt': 'unlocked-dependency\n',
        'other/main.py': 'value = 2\n',
    });
    const command = ['check', '--only', 'python/pip-installs', '--json'];
    const checked = await runGspot(sandbox.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: 'locked/requirements.txt', rule: 'requirements-file' },
    ]);
    expect(report.checks.filter((check) => check.status === 'failed').map((check) => check.scope)).toStrictEqual([
        'locked',
    ]);
    rmSync(join(sandbox.path, 'locked/requirements.txt'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
});

test('absent Python import contracts are explicit skips and malformed project files are errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        '.gspot/version': `${RUNNING_VERSION}\n`,
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json'];
    const absent = await runGspot(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect((JSON.parse(absent.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'python/import-linter',
            status: 'skipped',
            note: 'This scope has no tool.importlinter configuration.',
        },
    ]);
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[broken');
    const malformed = await runGspot(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/import-linter', status: 'error' },
    ]);
});
