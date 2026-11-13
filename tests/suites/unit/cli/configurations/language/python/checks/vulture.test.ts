import { join, sep } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { executableLayout } from '#cli/system/processes/programs.ts';
import { compareText } from '#cli/system/text/order.ts';
import { VULTURE_OUTPUT } from '#tests/config/configurations/python.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildPythonToolFiles, fakeToolExecutables } from '#tests/setup/cli/tools.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('vulture reads every Python file of the scope and reports unused definitions and unreachable code only', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all', scopes: [{ path: 'child' }] }),
        'app/nodes.py': 'def helper():\n    return 1\n',
        'app/main.py': 'import os\n',
        'child/other.py': 'VALUE = 1\n',
        [join(join(GSPOT_PATHS.pythonEnvironment, executableLayout.environmentFolder), 'vulture')]: 'stub',
        ...buildPythonToolFiles('vulture'),
    });
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'vulture')]);
    const output = [...VULTURE_OUTPUT].join('\n').replaceAll('app/', () => `app${sep}`);
    using spawn = fakeCommands().mockResolvedValue(buildProcessResult({ stdout: output, code: 3 }));
    const findings = await runSandboxCheck(sandbox.path, 'python/vulture');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'app/nodes.py', line: 1, rule: 'unused-function' },
        { file: 'app/nodes.py', line: 3, rule: 'unreachable-code' },
    ]);
    const command = spawn.mock.calls
        .map(([commandArguments]) => commandArguments)
        .find((commandArguments) => commandArguments.some((argument) => argument.endsWith('vulture')))!;
    expect(command.slice(-2).toSorted(compareText)).toStrictEqual(['app/main.py', 'app/nodes.py']);
});
