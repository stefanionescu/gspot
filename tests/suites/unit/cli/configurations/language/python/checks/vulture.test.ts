import { join, sep } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { executableLayout } from '#cli/system/paths.ts';
import * as processes from '#cli/system/processes.ts';
import { compareText } from '#cli/system/text.ts';
import { OS_SOURCE, VULTURE_OUTPUT } from '#tests/config/configurations/python.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildPythonToolFiles, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('vulture reads every Python file of the scope and reports unused definitions and unreachable code only', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', scopes: [{ path: 'child' }] }),
        'app/nodes.py': 'def helper():\n    return 1\n',
        'app/main.py': OS_SOURCE,
        'child/other.py': 'VALUE = 1\n',
        [join(join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder), 'vulture')]: 'stub',
        ...buildPythonToolFiles('vulture'),
    });
    const session = await openSession(sandbox.path);
    using resources = fakeToolExecutables([getTool(readConfigurations().values(), 'vulture')]);
    const output = [...VULTURE_OUTPUT].join('\n').replaceAll('app/', () => `app${sep}`);
    const spawn = resources.use(
        spyOn(processes, 'runProcess').mockResolvedValue(buildProcessResult({ stdout: output, code: 3 })),
    );
    const checked = await runChecks(session, buildRunOptions({ only: ['python/vulture'] }));
    const findings = checked.report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'app/nodes.py', line: 1, rule: 'unused-function' },
        { file: 'app/nodes.py', line: 3, rule: 'unreachable-code' },
    ]);
    const command = spawn.mock.calls
        .map(([commandArguments]) => commandArguments)
        .find((commandArguments) => commandArguments.some((argument) => argument.endsWith('vulture')))!;
    expect(command.slice(-2).toSorted(compareText)).toStrictEqual(['app/main.py', 'app/nodes.py']);
});
