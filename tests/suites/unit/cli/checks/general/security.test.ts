import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { runChecks } from '#cli/commands/check/run.ts';
import * as environment from '#cli/system/environment.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('security/semgrep without rule files is skipped with a note that names tools.semgrep.rule_files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python']),
        'source.py': 'PORT = 8080\n',
    });
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('linux');
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    const result = await runChecks(session, buildRunOptions({ only: ['security/semgrep'] }));
    expect(result.report.checks.map(({ check, status, note }) => ({ check, status, note }))).toStrictEqual([
        {
            check: 'security/semgrep',
            status: 'skipped',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        },
    ]);
});
