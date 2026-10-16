import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { checkFindings, openPinnedSession } from '#tests/setup/check-input.ts';

import {
    MIXED_REPORT,
    VALID_REPORT,
    DOCKER_VERSION,
    COMPOSE_SOURCES,
    INVALID_COMPOSE,
    REPORT_FAILURES,
    DOCKERIGNORE_CASES,
    TRIVY_FINDINGS_EXIT,
    DOCKER_CONTEXT_CASES,
    COMPOSE_PAIRING_CASES,
} from '#tests/data/checks/docker.ts';

test.each([...COMPOSE_SOURCES])('Trivy scans only service images in $name', async ({ source }) => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['docker']),
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
            return Promise.resolve(buildProcessResult({ code: TRIVY_FINDINGS_EXIT, stdout: VALID_REPORT }));
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
    const source = 'services: {app: {image: nginx:1.27.2}}\n';
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['docker']),
        'compose.yaml': source,
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(folder.path, ['trivy'], resources);
    resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult({ code, stdout, stderr })));
    expect(await captureRejection(checkFindings(session.root, 'docker/trivy-image'))).toContain(message);
});

test.each([...INVALID_COMPOSE])('Trivy refuses $name before scanning an image', async ({ source }) => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['docker']),
        'compose.yaml': source,
    });
    const session = await openSession(folder.path);
    using scan = spyOn(processes, 'spawnProcess');
    expect(await captureRejection(checkFindings(session.root, 'docker/trivy-image'))).toContain(
        'Cannot read Compose service images in compose.yaml.',
    );
    expect(scan).not.toHaveBeenCalled();
});

test('Trivy leaves build-only services unscanned', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['docker']),
        'compose.yaml': 'services: {app: {build: .}}\n',
    });
    const session = await openSession(folder.path);
    using scan = spyOn(processes, 'spawnProcess');
    expect(await checkFindings(session.root, 'docker/trivy-image')).toStrictEqual([]);
    expect(scan).not.toHaveBeenCalled();
});

test.each([...DOCKERIGNORE_CASES])('Docker ignore requirements follow $name', async ({ settings, text, missing }) => {
    await using sandbox = await testdir({
        'gspot.toml': `level = "all"\n${settings}`,
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
            'gspot.toml': buildSettingsText(['docker'], { level: 'all' }),
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
        'gspot.toml': buildSettingsText(['docker']),
        'compose.yaml': 'services: {app: {image: nginx:1.27.2}}\n',
        'docker-compose.prod.yml': 'services: {app: {image: nginx:1.27.2}}\n',
    });
    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['trivy'], resources);
    const scan = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: TRIVY_FINDINGS_EXIT, stdout: MIXED_REPORT }),
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
            'gspot.toml': buildSettingsText(['docker']),
            [base]: 'services: {app: {image: nginx:1.27.2}}\n',
            [override]: 'services: {app: {environment: {FEATURE: enabled}}}\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            fakePinnedExecutables([
                { ...getToolDeclaration(session.manifests.values(), 'docker'), version: DOCKER_VERSION },
            ]),
        );
        const toolRun = resources.use(spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult()));
        const planned = planRun(session, buildRunOptions({ stage: 'push', only: ['docker/compose'] }))[0]!;
        expect(await CHECK_IMPLEMENTATIONS['docker/compose'].run(session, planned)).toMatchObject({
            status: 'passed',
            findings: [],
        });
        expect(toolRun.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
            ['compose', '-f', base, '-f', override, 'config', '--quiet', '--no-env-resolution'],
        ]);
    },
);

test.each(['', 'app'])(
    'a missing ignore file lists the entries of the configurations selected in root and child (%j)',
    async (scope) => {
        const prefix = scope === '' ? '' : scope + '/';
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['docker'], {
                level: 'all',
                tables: '[[scope]]\npath = "app"\nconfigurations = ["python"]\n',
            }),
            Dockerfile: 'FROM scratch\n',
            'app/Dockerfile': 'FROM scratch\n',
        });
        const findings = await checkFindings(sandbox.path, 'docker/dockerignore', {
            paths: [prefix + 'Dockerfile'],
        });
        expect(findings).toMatchObject([
            {
                file: prefix + 'Dockerfile',
                rule: 'missing-file',
                message: `Add an ignore file at ${prefix}Dockerfile.dockerignore or ${prefix}.dockerignore that lists .git, .env${scope === '' ? '' : ', .venv, venv'}.`,
            },
        ]);
    },
);
