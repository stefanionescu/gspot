import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { NGINX_COMPOSE } from '#tests/config/checks/infrastructure/docker/samples.ts';
import { COMPOSE_PAIRING_CASES } from '#tests/config/checks/infrastructure/docker/compose.ts';

test.each([...COMPOSE_PAIRING_CASES])(
    'Compose $override runs after $base in one docker compose call',
    async ({ base, override }) => {
        const DOCKER_VERSION = '29.0.0';

        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            [base]: NGINX_COMPOSE,
            [override]: 'services: {app: {environment: {FEATURE: enabled}}}\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        const observed = fakeToolExecutables([
            { ...getTool(session.configurations.values(), 'docker'), version: DOCKER_VERSION },
        ]);
        resources.use(observed);
        const toolRun = resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult()));
        const planned = planChecks(session, buildRunOptions({ stage: 'push', only: ['docker/compose'] }))[0]!;
        const result = await runCheckCode(session, planned, findCheckCode(planned.check));
        expect(result.findings).toStrictEqual([]);
        expect(result.status).toBe('passed');
        expect(toolRun.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
            ['compose', '-f', base, '-f', override, 'config', '--quiet', '--no-env-resolution'],
        ]);
    },
);
