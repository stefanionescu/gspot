import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { trivyImage, dockerignore } from '#cli/checks/tool/docker.ts';

import {
    CLEAN_REPORT,
    MIXED_REPORT,
    VALID_REPORT,
    COMPOSE_SOURCES,
    INVALID_COMPOSE,
    REPORT_FAILURES,
    DOCKERIGNORE_CASES,
    TRIVY_FINDINGS_EXIT,
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
    expect(await trivyImage(buildCheckInput(session, 'docker/trivy-image'))).toStrictEqual([
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
    expect(await rejection(trivyImage(buildCheckInput(session, 'docker/trivy-image')))).toContain(diagnostic);
});

test('Trivy accepts a clean native report without finding an image defect', async () => {
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
    expect(await trivyImage(buildCheckInput(session, 'docker/trivy-image'))).toStrictEqual([]);
});

test.each(INVALID_COMPOSE)('Trivy refuses $name before scanning an image', async ({ source }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['docker']),
        'compose.yaml': source,
    });
    const session = await openSession(directory.path);
    using scan = spyOn(processes, 'run');
    expect(await rejection(trivyImage(buildCheckInput(session, 'docker/trivy-image')))).toContain(
        'Cannot read Compose service images in compose.yaml.',
    );
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
    expect(await trivyImage(buildCheckInput(session, 'docker/trivy-image'))).toStrictEqual([]);
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
    const findings = await trivyImage(buildCheckInput(session, 'docker/trivy-image'));
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        { file: 'compose.yaml', rule: 'CVE-example', message: 'nginx:1.27.2: CVE-example (example)' },
        { file: 'compose.yaml', rule: 'CVE-neighbor', message: 'nginx:1.27.2: CVE-neighbor (neighbor)' },
        { file: 'compose.yaml', rule: 'private-key', message: 'nginx:1.27.2: private-key: Private key' },
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
            const findings = dockerignore(input);
            expect(findings.map(({ rule }) => rule)).toStrictEqual(missing === '' ? [] : ['missing-entry']);
            if (missing !== '') expect(findings[0]!.message).toBe(`The ignore file lets through: ${missing}.`);
        },
    );
});
