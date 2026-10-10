import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { BUILT_IN_CHECKS, BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';

import {
    CLEAN_REPORT,
    MIXED_REPORT,
    VALID_REPORT,
    COMPOSE_SOURCES,
    INVALID_COMPOSE,
    REPORT_FAILURES,
    DOCKERIGNORE_CASES,
    DOCKER_HOST_VERSION,
    TRIVY_FINDINGS_EXIT,
    DOCKER_CONTEXT_CASES,
    COMPOSE_PAIRING_CASES,
} from '#tests/config/cli/checks/tool/docker.ts';

test.each(COMPOSE_SOURCES)('Trivy scans only service images in $name', async ({ source }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': source,
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'trivy')]));
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options) => {
            expect(command.at(-1)).toBe('nginx:1.27.2');
            expect(options.cwd).toBe(directory.path);
            return Promise.resolve({
                code: TRIVY_FINDINGS_EXIT,
                stdout: VALID_REPORT,
                stderr: '',
                missing: false,
                duration: 1,
            });
        }),
    );
    expect(
        await BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image')),
    ).toStrictEqual([
        {
            check: 'docker/trivy-image',
            file: 'compose.yaml',
            line: 1,
            rule: 'CVE-example',
            message: 'nginx:1.27.2: CVE-example (example)',
            fixable: false,
        },
    ]);
});

test.each(REPORT_FAILURES)('Trivy refuses $name with its diagnostic', async ({ code, stdout, stderr, diagnostic }) => {
    await using directory = await testdir();
    const source = 'services: {app: {image: nginx:1.27.2}}\n';
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': source,
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'trivy')]));
    resources.use(spyOn(processes, 'run').mockResolvedValue({ code, stdout, stderr, missing: false, duration: 1 }));
    expect(
        await rejection(BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image'))),
    ).toContain(diagnostic);
});

test('Trivy accepts a clean native report without an image finding', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': 'services: {app: {image: nginx:1.27.2}}\n',
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'trivy')]));
    resources.use(
        spyOn(processes, 'run').mockResolvedValue({
            code: 0,
            stdout: CLEAN_REPORT,
            stderr: '',
            missing: false,
            duration: 1,
        }),
    );
    expect(
        await BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image')),
    ).toStrictEqual([]);
});

test.each(INVALID_COMPOSE)('Trivy refuses $name before scanning an image', async ({ source }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': source,
    });
    const session = await openSession(directory.path);
    using scan = spyOn(processes, 'run');
    expect(
        await rejection(BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image'))),
    ).toContain('Cannot read Compose service images in compose.yaml.');
    expect(scan).not.toHaveBeenCalled();
});

test('Trivy leaves build-only services unscanned', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': 'services: {app: {build: .}}\n',
    });
    const session = await openSession(directory.path);
    using scan = spyOn(processes, 'run');
    expect(
        await BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image')),
    ).toStrictEqual([]);
    expect(scan).not.toHaveBeenCalled();
});

test('Trivy retains each native advisory and secret identity without exporting secret bytes', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': 'services: {app: {image: nginx:1.27.2}}\n',
    });
    const session = await openSession(directory.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'trivy')]));
    resources.use(
        spyOn(processes, 'run').mockResolvedValue({
            code: TRIVY_FINDINGS_EXIT,
            stdout: MIXED_REPORT,
            stderr: '',
            missing: false,
            duration: 1,
        }),
    );
    const findings = await BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image'));
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'compose.yaml', rule: 'CVE-example', message: 'nginx:1.27.2: CVE-example (example)' },
        { file: 'compose.yaml', rule: 'CVE-neighbor', message: 'nginx:1.27.2: CVE-neighbor (neighbor)' },
        { file: 'compose.yaml', rule: 'secret', message: 'nginx:1.27.2: private-key: Private key' },
    ]);
    expect(JSON.stringify(findings)).not.toContain('sensitive-native-value');
});

describe.each(['recommended', 'all'] as const)('%s Docker language ignores', (level) => {
    test.each(DOCKERIGNORE_CASES)(
        'Docker ignore requirements follow $name',
        async ({ policy, text, missing, scope }) => {
            await using sandbox = await testdir({
                'gspot.toml': `level = "${level}"\n${policy}`,
                [`${scope === '' ? '' : scope + '/'}Dockerfile`]: 'FROM scratch\n',
                [`${scope === '' ? '' : scope + '/'}.dockerignore`]: text,
            });
            const input = buildCheckInput(await openSession(sandbox.path), 'docker/dockerignore', { scope });
            const findings = BUILT_IN_CALCULATIONS['docker/dockerignore'](input);
            expect(findings.map(({ rule }) => rule)).toStrictEqual(missing === '' ? [] : ['missing-entry']);
            if (missing !== '')
                expect(findings[0]!.message).toBe(
                    `Add these entries to ${scope === '' ? '' : scope + '/'}.dockerignore: ${missing}.`,
                );
        },
    );
});

describe.each(['recommended', 'all'] as const)('%s Docker context ignores', (level) => {
    test.each(DOCKER_CONTEXT_CASES)('$name reports only its native ignore contract', async ({ files, findings }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['docker'], { level }), ...files });
        const input = buildCheckInput(await openSession(sandbox.path), 'docker/dockerignore');
        expect(
            BUILT_IN_CALCULATIONS['docker/dockerignore'](input).map(({ file, rule, message }) => ({
                file,
                rule,
                message,
            })),
        ).toStrictEqual(findings);
    });
});

test('Trivy scans a repeated image once and projects every advisory and secret to its declaring files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': 'services: {app: {image: nginx:1.27.2}}\n',
        'docker-compose.prod.yml': 'services: {app: {image: nginx:1.27.2}}\n',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'trivy')]));
    const scan = resources.use(
        spyOn(processes, 'run').mockResolvedValue({
            code: TRIVY_FINDINGS_EXIT,
            stdout: MIXED_REPORT,
            stderr: '',
            missing: false,
            duration: 1,
        }),
    );
    const findings = await BUILT_IN_CALCULATIONS['docker/trivy-image'](buildCheckInput(session, 'docker/trivy-image'));
    expect(scan).toHaveBeenCalledTimes(1);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        ['compose.yaml', 'docker-compose.prod.yml'].flatMap((file) => [
            { file, rule: 'CVE-example' },
            { file, rule: 'CVE-neighbor' },
            { file, rule: 'secret' },
        ]),
    );
    expect(JSON.stringify(findings)).not.toContain('sensitive-native-value');
});

test.each(COMPOSE_PAIRING_CASES)(
    'Compose $override runs after $base in the same native invocation',
    async ({ base, override }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['docker']),
            [base]: 'services: {app: {image: nginx:1.27.2}}\n',
            [override]: 'services: {app: {environment: {FEATURE: enabled}}}\n',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            mockPinnedExecutables([{ ...toolPin(session.manifests.values(), 'docker'), version: DOCKER_HOST_VERSION }]),
        );
        const native = resources.use(
            spyOn(processes, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 }),
        );
        const planned = planRun(session, buildRunOptions({ stage: 'push', only: ['docker/compose'] }))[0]!;
        expect(await BUILT_IN_CHECKS['docker/compose'].run(session, planned)).toMatchObject({
            status: 'passed',
            findings: [],
        });
        expect(native.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
            ['compose', '-f', base, '-f', override, 'config', '--quiet', '--no-env-resolution'],
        ]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s missing Docker ignore instructions list only selected language entries in root and child',
    async (level) => {
        for (const scope of ['', 'app']) {
            const prefix = scope === '' ? '' : scope + '/';
            await using sandbox = await testdir({
                'gspot.toml': buildPolicy(['docker'], { level, tables: '[scope.app]\nconfigurations = ["python"]\n' }),
                Dockerfile: 'FROM scratch\n',
                'app/Dockerfile': 'FROM scratch\n',
            });
            const findings = BUILT_IN_CALCULATIONS['docker/dockerignore'](
                buildCheckInput(await openSession(sandbox.path), 'docker/dockerignore', {
                    scope,
                    paths: [prefix + 'Dockerfile'],
                }),
            );
            expect(findings).toMatchObject([
                {
                    file: prefix + 'Dockerfile',
                    rule: 'missing-file',
                    message: `Add an ignore file at ${prefix}Dockerfile.dockerignore or ${prefix}.dockerignore that lists .git, .env${scope === '' ? '' : ', .venv'}.`,
                },
            ]);
        }
    },
);
