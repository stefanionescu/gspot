import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

import {
    NGINX_COMPOSE,
    COMPOSE_SOURCES,
    DOCKERIGNORE_CASES,
    TRIVY_IMAGE_FINDINGS,
    COMPOSE_PAIRING_CASES,
    TRIVY_REGISTRY_FAILURE,
    DOCKERIGNORE_ALLOWLISTS,
    INVALID_COMPOSE_SOURCES,
} from '#tests/config/checks/infrastructure/docker.ts';

async function scanImages(root: string, stdout: string, resources: DisposableStack) {
    const session = await openFakeToolSession(root, ['trivy'], resources);
    const scan = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ code: 10, stdout })),
    );
    return { scan, findings: await runSandboxCheck(session.root, 'docker/trivy-image') };
}

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
        const fakes = fakeToolExecutables([
            { ...getTool(session.configurations.values(), 'docker'), version: '29.0.0' },
        ]);
        resources.use(fakes);
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

test.each([...DOCKERIGNORE_ALLOWLISTS])(
    'docker/dockerignore respects ordered allowlist $text',
    async ({ text, missing }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': text,
        });
        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(findings).toStrictEqual(
            missing.length === 0
                ? []
                : [
                      {
                          check: 'docker/dockerignore',
                          file: '.dockerignore',
                          line: 1,
                          rule: 'missing-entry',
                          message: `Add these entries to .dockerignore: ${missing.join(', ')}.`,
                          fixable: false,
                          help: 'Add a .dockerignore beside the Dockerfile with the paths the message names.',
                      },
                  ],
        );
    },
);

test.each([...DOCKERIGNORE_CASES])(
    `docker/dockerignore requires an ignore file with the entries of each scope's configurations: $name`,
    async ({ files, findings: expectedFindings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker'], { level: 'all' }),
            ...files,
        });

        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
            ...expectedFindings,
        ]);
    },
);

test.each([...COMPOSE_SOURCES])('Trivy scans only service images in $name', async ({ source }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });

    using resources = new DisposableStack();
    const { scan, findings } = await scanImages(
        sandbox.path,
        '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}',
        resources,
    );
    expect(findings).toStrictEqual([...TRIVY_IMAGE_FINDINGS]);
    expect(scan.mock.calls.map(([command, options]) => ({ image: command.at(-1), cwd: options.cwd }))).toStrictEqual([
        { image: 'nginx:1.27.2', cwd: sandbox.path },
    ]);
});

test(`docker/trivy-image fails with Trivy's error text when Trivy exits 1`, async () => {
    const { code, stdout, stderr, message } = TRIVY_REGISTRY_FAILURE;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': NGINX_COMPOSE,
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['trivy'], resources);
    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ code, stdout, stderr })));
    const error = await captureRejection(runSandboxCheck(session.root, 'docker/trivy-image'));
    expect(error.message).toBe(message);
});

test.each([...INVALID_COMPOSE_SOURCES])(
    'docker/trivy-image fails on $name in compose.yaml before it runs Trivy',
    async ({ source, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            'compose.yaml': source,
        });

        using scan = spyOn(processes, 'spawnProcess');
        const scanError = await captureRejection(runSandboxCheck(sandbox.path, 'docker/trivy-image'));
        expect(scanError.message).toBe(message);
        expect(scan).not.toHaveBeenCalled();
    },
);

test('Trivy scans a repeated image once and reports each advisory and secret in every Compose file that names it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': NGINX_COMPOSE,
        'docker-compose.prod.yml': NGINX_COMPOSE,
    });
    using resources = new DisposableStack();
    const { scan, findings } = await scanImages(
        sandbox.path,
        '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"},{"VulnerabilityID":"CVE-neighbor","PkgName":"neighbor"}],"Secrets":[{"RuleID":"private-key","Title":"Private key","Secret":"sensitive-native-value"}]}]}',
        resources,
    );
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
