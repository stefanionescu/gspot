import { testdir } from 'testdirs';
import { basename } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { openFakeToolSession } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';

test('ShellCheck chooses Bash only for headerless scripts without a declared dialect', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'library.sh': 'VALUE=1\n',
        'run.sh': '#!/bin/sh\nVALUE=1\n',
        'tool.bash': 'VALUE=1\n',
        'suite.bats': '@test "ready" { true; }\n',
    });
    await applyGeneratedFiles(sandbox.path);
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['shellcheck'], resources);
    const calls: string[][] = [];
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command) => {
            calls.push([...command]);
            return Promise.resolve(buildProcessResult({ stdout: '[]' }));
        }),
    );
    const result = await runChecks(session, buildRunOptions({ only: ['bash/shellcheck'] }));
    expect(result.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'passed', findings: [] },
    ]);
    expect(
        calls.map((call) => ({
            bash: call.includes('--shell=bash'),
            files: call
                .filter((argument) => /\.(?:sh|bash|bats)$/u.test(argument))
                .map((path) => basename(path))
                .toSorted((left, right) => left.localeCompare(right)),
        })),
    ).toStrictEqual([
        { bash: true, files: ['library.sh'] },
        { bash: false, files: ['run.sh', 'suite.bats', 'tool.bash'] },
    ]);
});
