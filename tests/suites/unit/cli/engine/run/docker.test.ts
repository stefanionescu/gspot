import { test, expect } from 'bun:test';
import { getTool } from '#cli/tools/pins.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

test('Docker checks report an unavailable daemon before running', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': 'events {}',
    });
    const session = await openSession(sandbox.path);
    const docker = getTool(readConfigurations().values(), 'docker');
    using _tools = fakeToolExecutables([docker]);
    for (const scope of session.scopes) {
        const configuration = scope.configurations.find(({ name }) => name === 'nginx')!;
        const selected = configuration.checks.find(({ id }) => id === 'nginx/syntax')!;
        scope.configurations = scope.configurations.map((configured) =>
            configured === configuration
                ? {
                      ...configuration,
                      checks: [selected, { ...selected, id: 'nginx/second' }],
                  }
                : configured,
        );
    }
    using _docker = fakeCommands('docker', () =>
        Promise.resolve(buildProcessResult({ code: 1, stderr: 'Cannot connect to Docker.' })),
    );
    const result = await runChecks(session, buildRunOptions({ only: ['nginx/syntax', 'nginx/second'] }));
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'nginx/syntax', status: 'missing' },
        { check: 'nginx/second', status: 'missing' },
    ]);
});
