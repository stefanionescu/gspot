import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { LOCKED_SCOPE_SETTINGS, REQUIREMENTS_FILE_FINDING } from '#tests/config/configurations/python.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a requirements file is reported only in a scope with a lockfile and passes once removed', async () => {
    await using sandbox = await createGitSandbox({
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

    expect(
        checked.report.checks.flatMap((check) => check.findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([REQUIREMENTS_FILE_FINDING]);
});

test('an unmanaged pip install reports its file and rule', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'uv.lock': 'version = 1\n',
        'install.sh': 'pip install requests\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'python/pip-installs');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        {
            file: 'install.sh',
            line: 1,
            rule: 'pip-install',
        },
    ]);
});
