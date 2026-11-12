import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { buildCopyPythonEnvironment, findMissingEnvironment } from '#cli/tools/python-environment.ts';
import { APP_PYPROJECT } from '#tests/config/setup/languages.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

test.each([
    { active: undefined, isFound: false },
    { active: '', isFound: true },
    { active: 'missing', isFound: false },
])('VIRTUAL_ENV $active stands in for the .venv of the project when it names a folder', async ({ active, isFound }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': APP_PYPROJECT,
        'app.py': 'count = 1\n',
    });
    await using environment = await testdir({ 'bin/python': '' });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'python/basedpyright');
    const path = active === undefined ? undefined : join(environment.path, active);
    using _variable = overrideEnvironment({ VIRTUAL_ENV: path });
    const roots = { root: sandbox.path, toolsRoot: sandbox.path };
    const expected: Record<string, string> = isFound && path !== undefined ? { UV_PROJECT_ENVIRONMENT: path } : {};
    expect({
        missing: findMissingEnvironment(session, planned)?.status,
        environment: buildCopyPythonEnvironment(roots, ''),
    }).toStrictEqual({ missing: isFound ? undefined : 'missing', environment: expected });
});
