import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { TRIVY_FINDINGS_EXIT_CODE } from '#cli/config/checks/docker.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { checkFindings, openPinnedSession } from '#tests/setup/check-input.ts';

import {
    MIXED_REPORT,
    VALID_REPORT,
    NGINX_COMPOSE,
    DOCKER_VERSION,
    COMPOSE_SOURCES,
    INVALID_COMPOSE,
    REPORT_FAILURES,
    DOCKERIGNORE_CASES,
    DOCKER_CONTEXT_CASES,
    COMPOSE_PAIRING_CASES,
} from '#tests/data/checks/docker.ts';

test.each([...COMPOSE_SOURCES])('Trivy scans only service images in $name', async ({ source }) => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });

    using resources = new DisposableStack();
    const session = await openPinnedSession(folder.path, ['trivy'], resources);
    const nativeRun = processes.spawnProcess;
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] === 'git') return nativeRun(command, options);
            expect(command.at(-1)).toBe('nginx:1.27.2');
            expect(options.cwd).toBe(folder.path);
            return Promise.resolve(buildProcessResult({ code: TRIVY_FINDINGS_EXIT_CODE, stdout: VALID_REPORT }));
        }),
    );
    expect(await checkFindings(session.root, 'docker/trivy-image')).toStrictEqual([
        {
            check: 'docker/trivy-image',
            help: 'Move to a newer tag of the image. Accept one advisory with `gspot ignore docker/trivy-image --rule <id> --reason "..."`.',
            file: 'compose.yaml',
            line: 1,
            rule: 'CVE-example',
            message: 'nginx:1.27.2: CVE-example (example)',
            fixable: false,
        },
    ]);
});

test('a fatal registry failure is reported with its diagnostic', async () => {
    const { code, stdout, stderr, message } = REPORT_FAILURES;
    await using folder = await testdir();
    const source = NGINX_COMPOSE;
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(folder.path, ['trivy'], resources);
    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ code, stdout, stderr })));
    expect(await captureRejection(checkFindings(session.root, 'docker/trivy-image'))).toContain(message);
});

test.each([...INVALID_COMPOSE])('Trivy refuses $name before scanning an image', async ({ source, message }) => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });

    using scan = spyOn(processes, 'spawnProcess');
    expect(await captureRejection(checkFindings(folder.path, 'docker/trivy-image'))).toContain(message);
    expect(scan).not.toHaveBeenCalled();
});

test.each([...DOCKERIGNORE_CASES])('Docker ignore requirements follow $name', async ({ settings, text, missing }) => {
    await using sandbox = await testdir({
        'gspot.toml': settings,
        Dockerfile: 'FROM scratch\n',
        '.dockerignore': text,
    });

    const findings = await checkFindings(sandbox.path, 'docker/dockerignore', {
        paths: ['Dockerfile'],
    });
    expect(findings.map(({ rule }) => rule)).toStrictEqual(missing === '' ? [] : ['missing-entry']);
    if (missing !== '') expect(findings[0]!.message).toBe(`Add these entries to .dockerignore: ${missing}.`);
});

test.each([...DOCKER_CONTEXT_CASES])(
    'a Dockerfile needs an ignore file that lists .git and .env: $name',
    async ({ files, findings: expectedFindings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker'], { level: 'all' }),
            ...files,
        });

        const findings = await checkFindings(sandbox.path, 'docker/dockerignore');
        expect(
            findings.map(({ file, rule, message }) => ({
                file,
                rule,
                message,
            })),
        ).toStrictEqual([...expectedFindings]);
    },
);

test('Trivy scans a repeated image once and reports each advisory and secret in every Compose file that names it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': NGINX_COMPOSE,
        'docker-compose.prod.yml': NGINX_COMPOSE,
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['trivy'], resources);
    const scan = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: TRIVY_FINDINGS_EXIT_CODE, stdout: MIXED_REPORT }),
        ),
    );
    const findings = await checkFindings(session.root, 'docker/trivy-image');
    expect(scan).toHaveBeenCalledTimes(1);
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual(
        ['compose.yaml', 'docker-compose.prod.yml'].flatMap((file) => [
            { file, rule: 'CVE-example', message: 'nginx:1.27.2: CVE-example (example)' },
            { file, rule: 'CVE-neighbor', message: 'nginx:1.27.2: CVE-neighbor (neighbor)' },
            { file, rule: 'secret', message: 'nginx:1.27.2: private-key: Private key' },
        ]),
    );
    expect(JSON.stringify(findings)).not.toContain('sensitive-native-value');
});

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
