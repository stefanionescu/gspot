import { join } from 'node:path';
import { promisify } from 'node:util';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { isLinux } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { randomUUID, generateKeyPair } from 'node:crypto';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    DOCKER_CASES,
    DOCKER_SANDBOX,
    ALPINE_DOCKERFILE,
    DEBIAN_DOCKERFILE,
    TRIVY_CONFIG_PATH,
    ROOT_USER_DOCKERFILE,
    TRIVY_SCOPE_SETTINGS,
} from '#tests/data/checks/docker.ts';

test('Trivy checks each Dockerfile in its deepest scope and honors an ignore limited to a scope path', async () => {
    await using sandbox = await testdir();
    // Trivy rule DS-0002 reports `USER root`. Use `USER node` to fix it.

    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const settings = buildSettingsText(['docker'], {
        tables: TRIVY_SCOPE_SETTINGS,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, ROOT_USER_DOCKERFILE])),
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'untracked/Dockerfile'), ROOT_USER_DOCKERFILE);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'docker/trivy-config', '--json'];
    const failedCommand = await spawnGspot(sandbox.path, command);
    const failed = JSON.parse(failedCommand.stdout) as RunReport;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(
        failed.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', files: ['Dockerfile'] },
        { scope: 'app', status: 'passed', files: [] },
        { scope: 'app/child', status: 'passed', files: [] },
        { scope: 'sibling', status: 'failed', files: ['sibling/Dockerfile'] },
    ]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await Bun.write(join(sandbox.path, path), ROOT_USER_DOCKERFILE.replace('USER root', 'USER node'));
    const correctedCommand = await spawnGspot(sandbox.path, command);
    const corrected = JSON.parse(correctedCommand.stdout) as RunReport;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
});

test.each([...LEVELS])(
    'Hadolint checks apt and apk version pins only at level all, in the root and a scope',
    async (level) => {
        await using sandbox = await testdir();

        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['docker'], {
                level,
                tables: `[[scope]]
path = "app"

configurations = ["docker"]
`,
            }),
            Dockerfile: DEBIAN_DOCKERFILE,
            'Dockerfile.alpine': ALPINE_DOCKERFILE,
            'app/Dockerfile': DEBIAN_DOCKERFILE,
            'app/Dockerfile.alpine': ALPINE_DOCKERFILE,
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        for (const scope of ['', 'app']) {
            const prefix = scope === '' ? '' : `${scope}/`;
            const result = await spawnGspot(sandbox.path, [
                'check',
                `${prefix}Dockerfile`,
                `${prefix}Dockerfile.alpine`,
                '--only',
                'docker/hadolint',
                '--json',
            ]);
            expect(result.code, result.stdout + result.stderr).toBe(level === 'all' ? 1 : 0);
            const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
            expect(findings.map((finding) => finding.rule)).toStrictEqual(level === 'all' ? ['DL3008', 'DL3018'] : []);
            await Bun.write(
                join(sandbox.path, `${prefix}Dockerfile`),
                DEBIAN_DOCKERFILE.replace('debian:12', 'debian:latest'),
            );
            const unpinned = await spawnGspot(sandbox.path, [
                'check',
                `${prefix}Dockerfile`,
                '--only',
                'docker/hadolint',
                '--json',
            ]);
            expect(unpinned.code, unpinned.stdout + unpinned.stderr).toBe(1);
            expect((JSON.parse(unpinned.stdout) as RunReport).checks.flatMap((check) => check.findings)).toContainEqual(
                matchFields({ rule: 'DL3007' }),
            );
        }
    },
);

// Each tag owns an explicit payload, so a clean image never depends on loop position.
async function importImage(root: string, tag: string, payload: string | Buffer): Promise<void> {
    await writeFile(join(root, 'payload.pem'), payload);
    const archive = runCommandBlocking(['tar', '-cf', 'payload.tar', 'payload.pem'], { cwd: root });
    if (archive.code !== 0) throw new Error(archive.stderr);
    const imported = runCommandBlocking(['docker', 'import', 'payload.tar', tag], {
        cwd: root,
    });
    if (imported.code !== 0) throw new Error(imported.stderr);
}

// These Docker checks need the Linux Docker engine.
test.skipIf(!isLinux)(
    'docker/trivy-image reports a private key in an image, errors on a broken tool file, and passes a clean image',
    async () => {
        await using sandbox = await testdir();
        const prefix = `gspot-tools-image-${randomUUID()}`;
        const tags = [`${prefix}:defect`, `${prefix}:corrected`] as const;
        const { privateKey: key } = await promisify(generateKeyPair)('rsa', { modulusLength: 2048 });
        const privateKey = key.export({
            type: 'pkcs1',
            format: 'pem',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['docker']),
            'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
            'payload.pem': privateKey,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const configPath = join(sandbox.path, TRIVY_CONFIG_PATH);
        const configuration = await Bun.file(configPath).text();
        const command = ['check', '--only', 'docker/trivy-image', '--json'];
        try {
            await importImage(sandbox.path, tags[0], privateKey);
            await importImage(sandbox.path, tags[1], 'No credentials in this image.\n');
            const failed = await spawnGspot(sandbox.path, command);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
            expect(findings[0]!.message).not.toContain('BEGIN RSA PRIVATE KEY');
            expect(findings).toMatchObject([
                { file: 'compose.yaml', line: 1, rule: 'secret', message: matchSubstring('private-key') },
            ]);
            await Bun.write(configPath, 'severity: [');
            const broken = await spawnGspot(sandbox.path, command);
            expect(broken.code, broken.stdout + broken.stderr).toBe(2);
            expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
                { status: 'error', note: matchSubstring('Trivy could not scan') },
            ]);
            await Bun.write(configPath, configuration);
            await Bun.write(join(sandbox.path, 'compose.yaml'), `services: {app: {image: "${tags[1]}"}}\n`);
            const corrected = await spawnGspot(sandbox.path, command);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(
                (JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings),
            ).toStrictEqual([]);
        } finally {
            runCommandBlocking(['docker', 'image', 'rm', '--force', ...tags], { cwd: sandbox.path });
        }
    },
);

const installedSandbox = registerSharedSandbox(DOCKER_SANDBOX);

for (const entry of DOCKER_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        const expected =
            'message' in entry.expected
                ? { ...entry.expected, message: matchSubstring(entry.expected.message) }
                : entry.expected;
        const result = await runCheckSample(installedSandbox(), { ...entry, expected }, DOCKER_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary({ ...entry, expected }));
    });
}
