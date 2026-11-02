import { sep, join } from 'node:path';
import { getTool } from '#cli/tools/pins.ts';
import { runChecks } from '#cli/engine/run.ts';
import { test, spyOn, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { executableLayout } from '#cli/system/paths.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { OS_SOURCE, VULTURE_OUTPUT } from '#tests/config/configurations/python.ts';
import { fakeToolExecutables, buildPythonToolFiles } from '#tests/setup/system/fakes.ts';

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
    const output = [...VULTURE_OUTPUT].join('\n').replaceAll('app/', `app${sep}`);
    const spawn = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ stdout: output, code: 3 })),
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
    expect(command.slice(1).toSorted(compareText)).toStrictEqual(['app/main.py', 'app/nodes.py']);
});
