import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';
import { NGINX_COMPOSE } from '#tests/config/checks/infrastructure/docker/samples.ts';
import { TRIVY_FINDINGS_EXIT_CODE } from '#cli/config/checks/infrastructure/docker/trivy-image.ts';

import {
    TRIVY_REPORT,
    COMPOSE_SOURCES,
    TRIVY_MIXED_REPORT,
    TRIVY_IMAGE_FINDINGS,
    TRIVY_REGISTRY_FAILURE,
    INVALID_COMPOSE_SOURCES,
} from '#tests/config/checks/infrastructure/docker/trivy-image.ts';

test.each([...COMPOSE_SOURCES])('Trivy scans only service images in $name', async ({ source }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        'compose.yaml': source,
    });

    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['trivy'], resources);
    const nativeRun = processes.spawnProcess;
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] === 'git') return nativeRun(command, options);
            expect(command.at(-1)).toBe('nginx:1.27.2');
            expect(options.cwd).toBe(sandbox.path);
            return Promise.resolve(buildProcessResult({ code: TRIVY_FINDINGS_EXIT_CODE, stdout: TRIVY_REPORT }));
        }),
    );
    expect(await runSandboxCheck(session.root, 'docker/trivy-image')).toStrictEqual([...TRIVY_IMAGE_FINDINGS]);
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
    expect(await captureRejection(runSandboxCheck(session.root, 'docker/trivy-image'))).toBe(message);
});
test.each([...INVALID_COMPOSE_SOURCES])(
    'docker/trivy-image fails on $name in compose.yaml before it runs Trivy',
    async ({ source, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            'compose.yaml': source,
        });

        using scan = spyOn(processes, 'spawnProcess');
        expect(await captureRejection(runSandboxCheck(sandbox.path, 'docker/trivy-image'))).toStartWith(message);
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
    const session = await openFakeToolSession(sandbox.path, ['trivy'], resources);
    const scan = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: TRIVY_FINDINGS_EXIT_CODE, stdout: TRIVY_MIXED_REPORT }),
        ),
    );
    const findings = await runSandboxCheck(session.root, 'docker/trivy-image');
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
