import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { getTool } from '#cli/manifests/tools.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

test('Docker checks share one daemon request and report an unavailable daemon before running', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nginx']),
        'nginx.conf': 'events {}',
    });
    const session = await openSession(sandbox.path);
    const docker = getTool(session.configurationsByName.values(), 'docker');
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
    const commands: string[][] = [];
    using _docker = fakeCommands('docker', (command) => {
        commands.push([...command]);
        return Promise.resolve(buildProcessResult({ code: 1, stderr: 'Cannot connect to Docker.' }));
    });
    const result = await runChecks(session, buildRunOptions({ only: ['nginx/syntax', 'nginx/second'] }));
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks.map(({ check, status, note }) => ({ check, status, note }))).toStrictEqual([
        { check: 'nginx/syntax', status: 'missing', note: 'Start Docker, then run the check again.' },
        { check: 'nginx/second', status: 'missing', note: 'Start Docker, then run the check again.' },
    ]);
    expect(commands.map((command) => command.slice(1))).toStrictEqual([['info']]);
});
