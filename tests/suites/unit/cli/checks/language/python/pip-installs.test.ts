import { join } from 'node:path';
import { testdir } from 'testdirs';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { LOCKED_SCOPE_SETTINGS, REQUIREMENTS_FILE_FINDING } from '#tests/config/checks/language/python/pip-installs.ts';

test('a requirements file is reported only in a scope with a lockfile and passes once removed', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], LOCKED_SCOPE_SETTINGS),
        'requirements.txt': 'root-dependency\n',
        'locked/uv.lock': 'version = 1\n',
        'locked/requirements.txt': 'duplicated-dependency\n',
        'locked/main.py': 'value = 1\n',
        'other/requirements.txt': 'unlocked-dependency\n',
        'other/main.py': 'value = 2\n',
    });

    const checked = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['python/pip-installs'] }),
    );

    expect(checked.report.checks.flatMap((check) => check.findings)).toStrictEqual([REQUIREMENTS_FILE_FINDING]);
    expect(
        checked.report.checks.filter((check) => check.status === 'failed').map((check) => check.scope),
    ).toStrictEqual(['locked']);
    await rm(join(sandbox.path, 'locked/requirements.txt'));
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['python/pip-installs'] }),
    );

    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
});

test('an unmanaged pip install reports the complete source finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python']),
        'uv.lock': 'version = 1\n',
        'install.sh': 'pip install requests\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'python/pip-installs')).toStrictEqual([
        {
            check: 'python/pip-installs',
            file: 'install.sh',
            line: 1,
            rule: 'pip-install',
            fixable: false,
            message: 'Add the package to pyproject.toml and install it from the lockfile.',
            help: REQUIREMENTS_FILE_FINDING.help,
        },
    ]);
});
