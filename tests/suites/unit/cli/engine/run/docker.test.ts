import { expect, test } from 'bun:test';

import { DOCKER_DAEMON_NOTE } from '#cli/config/engine.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openFakeToolSession } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('Docker checks report an unavailable daemon before running', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': 'events {}',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['docker'], resources);
    using run = fakeCommands('docker', () =>
        Promise.resolve(buildProcessResult({ code: 1, stderr: 'Cannot connect to Docker.' })),
    );
    const result = await runChecks(session, buildRunOptions({ only: ['nginx/syntax'] }));
    expect(result.report.checks).toMatchObject([
        { check: 'nginx/syntax', status: 'missing', note: DOCKER_DAEMON_NOTE },
    ]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([['info']]);
});
