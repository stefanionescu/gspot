import { test, expect } from 'bun:test';
import { getTool } from '#cli/tools/pins.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';
import { buildRunOptions, CHECK_GENERATION, CHECK_RUN_OPTIONS } from '#tests/setup/cli/run.ts';

import {
    NGINX_COMPOSE,
    COMPOSE_SOURCES,
    DOCKERIGNORE_CASES,
    TRIVY_IMAGE_FINDINGS,
    COMPOSE_PAIRING_CASES,
    TRIVY_REGISTRY_FAILURE,
    DOCKERIGNORE_ALLOWLISTS,
    INVALID_COMPOSE_SOURCES,
} from '#tests/config/configurations/docker.ts';

async function scanImages(root: string, stdout: string, resources: DisposableStack) {
    const session = await openFakeToolSession(root, ['trivy'], resources);
    const scan = resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ code: 10, stdout })));
    return { scan, findings: await runSandboxCheck(session.root, 'docker/trivy-image') };
}

test.each([...COMPOSE_PAIRING_CASES])(
    'Compose $override runs after $base in one docker compose call',
    async ({ base, override }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docker']),
            [base]: NGINX_COMPOSE,
            [override]: 'services: {app: {environment: {FEATURE: enabled}}}\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        const fakes = fakeToolExecutables([{ ...getTool(readConfigurations().values(), 'docker'), version: '29.0.0' }]);
        resources.use(fakes);
        const toolRun = resources.use(fakeCommands().mockResolvedValue(buildProcessResult()));
        const planned = planChecks(session, buildRunOptions({ stage: 'push', only: ['docker/compose'] }))[0]!;
        const result = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            planned,
            CHECK_CODE['docker/compose'],
            CHECK_RUN_OPTIONS,
        );
        expect(result.findings).toStrictEqual([]);
        expect(result.status).toBe('passed');
        expect(
            toolRun.mock.calls.map(([command]) => command.filter((_, index) => command[index - 1] === '-f')),
        ).toStrictEqual([[base, override]]);
    },
);

test.each([...DOCKERIGNORE_ALLOWLISTS])(
    'docker/dockerignore respects ordered allowlist $text',
    async ({ text, missing }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docker']),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': text,
        });
        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        const entries = missing.join(', ');
        expect(findings).toStrictEqual(
            missing.length === 0
                ? []
                : [
                      expect.objectContaining({
                          file: '.dockerignore',
                          line: 1,
                          rule: 'missing-entry',
                          message: expect.stringContaining(entries) as string,
                      }),
                  ],
        );
    },
);

test.each([...DOCKERIGNORE_CASES])(
    "docker/dockerignore requires an ignore file with the patterns of each scope's configurations: $name",
    async ({ configurations, options, files, findings: expectedFindings }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(configurations, options),
            ...files,
        });

        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
            ...expectedFindings,
        ]);
    },
);

test.each([...COMPOSE_SOURCES])('Trivy scans only service images in $name', async ({ source }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });

    using resources = new DisposableStack();
    const { scan, findings } = await scanImages(
        sandbox.path,
        '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}',
        resources,
    );
    expect(findings).toStrictEqual(TRIVY_IMAGE_FINDINGS.map((finding) => matchFields(finding)));
    expect(scan.mock.calls.map(([command, options]) => ({ image: command.at(-1), cwd: options.cwd }))).toStrictEqual([
        { image: 'nginx:1.27.2', cwd: sandbox.path },
    ]);
});

test(`docker/trivy-image fails with Trivy's error text when Trivy exits 1`, async () => {
    const { code, stdout, stderr } = TRIVY_REGISTRY_FAILURE;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': NGINX_COMPOSE,
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['trivy'], resources);
    resources.use(fakeCommands().mockResolvedValue(buildProcessResult({ code, stdout, stderr })));
    const error = await captureRejection(runSandboxCheck(session.root, 'docker/trivy-image'));
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
    expect(error.message).toContain(stderr);
});

test.each([...INVALID_COMPOSE_SOURCES])(
    'docker/trivy-image reports syntax for $name in compose.yaml before it runs Trivy',
    async ({ source }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docker']),
            'compose.yaml': source,
        });

        using scan = fakeCommands();
        const findings = await runSandboxCheck(sandbox.path, 'docker/trivy-image');
        expect(findings).toMatchObject([{ file: 'compose.yaml', rule: 'syntax' }]);
        expect(scan).not.toHaveBeenCalled();
    },
);

test('Trivy scans a repeated image once and reports each advisory and secret in every Compose file that names it', async () => {
    await using sandbox = await createGitSandbox({
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

test.each([
    ['RUN npm install', 'lockfile-install'],
    ['RUN npm install --omit=dev', 'lockfile-install'],
    ['RUN pnpm install', 'lockfile-install'],
    ['RUN bun install', 'lockfile-install'],
    ['RUN yarn install', 'lockfile-install'],
    ['RUN uv sync', 'lockfile-install'],
    ['RUN npm ci && \\\n    uv sync', 'lockfile-install'],
    ['RUN curl -fsSL https://example.com/install.sh | sh', 'piped-download'],
    ['RUN wget -qO- https://example.com/install.sh | sudo bash', 'piped-download'],
    ['FROM nginx:alpine', 'nginx-tag'],
    ['FROM nginx:1.27', 'nginx-tag'],
    ['FROM nginx', 'nginx-tag'],
    ['ENTRYPOINT ["/bin/sh", "-c", "nginx"]', 'shell-entrypoint'],
])('docker/instructions reports %s as %s', async (line, rule) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: `${line}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'docker/instructions');
    expect(findings.map((finding) => finding.rule)).toStrictEqual([rule]);
});

test.each([
    'RUN npm ci',
    'RUN npm install left-pad',
    'RUN pnpm install --frozen-lockfile',
    'RUN yarn install --immutable',
    'RUN uv sync --locked',
    'RUN curl -fsSL https://example.com/file --output file',
    'FROM nginx:1.27.3-alpine',
    'FROM nginx@sha256:0000000000000000000000000000000000000000000000000000000000000000',
    'FROM node:24-alpine',
    'ENTRYPOINT ["nginx", "-g", "daemon off;"]',
])('docker/instructions accepts %s', async (line) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: `${line}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'docker/instructions')).toStrictEqual([]);
});

test('docker/dockerignore reports a COPY source that the ignore file excludes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: 'FROM scratch\nCOPY ./private/ /app/\nCOPY src /app/src\nCOPY --from=build private /app/\n',
        '.dockerignore': '.git\nprivate/\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
    expect(
        findings
            .filter(({ rule }) => rule === 'ignored-source')
            .map(({ file, line, message }) => ({ file, line, message })),
    ).toStrictEqual([{ file: 'Dockerfile', line: 2, message: expect.stringContaining('private') as string }]);
});
