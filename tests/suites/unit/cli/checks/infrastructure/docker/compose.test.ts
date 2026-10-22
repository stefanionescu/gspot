import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { NGINX_COMPOSE } from '#tests/config/checks/infrastructure/docker/samples.ts';
import { DOCKER_VERSION, COMPOSE_PAIRING_CASES } from '#tests/config/checks/infrastructure/docker/compose.ts';

test.each([...COMPOSE_PAIRING_CASES])(
    'Compose $override runs after $base in one docker compose call',
    async ({ base, override }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            [base]: NGINX_COMPOSE,
            [override]: 'services: {app: {environment: {FEATURE: enabled}}}\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            fakePinnedExecutables([{ ...getTool(session.configurations.values(), 'docker'), version: DOCKER_VERSION }]),
        );
        const toolRun = resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult()));
        const planned = planChecks(session, buildRunOptions({ stage: 'push', only: ['docker/compose'] }))[0]!;
        expect(await runCheckCode(session, planned, findCheckCode(planned.check))).toMatchObject({
            status: 'passed',
            findings: [],
        });
        expect(toolRun.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
            ['compose', '-f', base, '-f', override, 'config', '--quiet', '--no-env-resolution'],
        ]);
    },
);
