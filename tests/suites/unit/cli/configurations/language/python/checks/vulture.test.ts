import { join, sep } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runChecks } from '#cli/engine/run.ts';
import { executableLayout } from '#cli/system/paths.ts';
import * as processes from '#cli/system/processes.ts';
import { compareText } from '#cli/system/text.ts';
import { OS_SOURCE, VULTURE_OUTPUT } from '#tests/config/configurations/python.ts';
import { openFakeToolSession } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildPythonToolFiles } from '#tests/setup/system/fakes.ts';
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
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['vulture'], resources);
    const output = [...VULTURE_OUTPUT].join('\n').replaceAll('app/', () => `app${sep}`);
    const spawn = resources.use(
        spyOn(processes, 'runProcess').mockResolvedValue(buildProcessResult({ stdout: output, code: 3 })),
    );
    const checked = await runChecks(session, buildRunOptions({ only: ['python/vulture'] }));
    expect(listFindingRows(checked.report)).toStrictEqual([
        { file: 'app/nodes.py', line: 1, rule: 'unused-function' },
        { file: 'app/nodes.py', line: 3, rule: 'unreachable-code' },
    ]);
    const command = spawn.mock.calls
        .map(([commandArguments]) => commandArguments)
        .find((commandArguments) => commandArguments.some((argument) => argument.endsWith('vulture')))!;
    expect(command.slice(-2).toSorted(compareText)).toStrictEqual(['app/main.py', 'app/nodes.py']);
});
