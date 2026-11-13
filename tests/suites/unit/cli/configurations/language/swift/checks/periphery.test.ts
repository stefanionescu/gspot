import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { prepareSwiftCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('swift/periphery skips when the build fails', async () => {
    await using sandbox = await createGitSandbox({});
    await using prepared = await prepareSwiftCheck(sandbox, 'swift/periphery');
    using run = fakeCommands().mockResolvedValue(buildProcessResult({ code: 1 }));
    const { report } = await runChecks(prepared.session, buildRunOptions({ only: ['swift/periphery'] }));
    expect(report.checks).toMatchObject([
        { check: 'swift/periphery', status: 'skipped', note: expect.any(String) as string },
    ]);
    expect(run.mock.calls.filter(([command]) => command.includes('scan'))).toStrictEqual([]);
});
