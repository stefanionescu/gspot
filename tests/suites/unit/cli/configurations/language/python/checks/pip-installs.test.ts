import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { REQUIREMENTS_FILE_FINDINGS } from '#tests/config/configurations/python.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a requirements file is reported only in a scope with a lockfile', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [
                { path: 'locked', configurations: ['python'] },
                { path: 'other', configurations: ['python'] },
            ],
        }),
        'requirements.txt': 'root-dependency\n',
        'locked/uv.lock': 'version = 1\n',
        'locked/requirements.txt': 'duplicated-dependency\n',
        'locked/requirements/dev.txt': 'development-dependency\n',
        'locked/main.py': 'value = 1\n',
        'other/requirements.txt': 'unlocked-dependency\n',
        'other/main.py': 'value = 2\n',
    });

    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['python/pip-installs'] }),
    );
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: 'locked', status: 'failed' },
    ]);
    expect(listFindingRows(report)).toStrictEqual([...REQUIREMENTS_FILE_FINDINGS]);
});

test('an unmanaged pip install reports its file and rule, and a commented one does not', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'uv.lock': 'version = 1\n',
        'install.sh': 'pip install requests\n# pip install requests\n',
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
