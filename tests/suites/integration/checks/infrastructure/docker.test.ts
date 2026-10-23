import { promisify } from 'node:util';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isLinux } from '#tests/setup/system/platform.ts';
import { randomUUID, generateKeyPair } from 'node:crypto';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    DOCKER_CASES,
    DOCKER_SANDBOX,
    ALPINE_DOCKERFILE,
    DEBIAN_DOCKERFILE,
    TRIVY_CONFIG_PATH,
    TRIVY_SCOPE_TABLES,
    TRIVY_SCOPE_RESULTS,
    ROOT_USER_DOCKERFILE,
} from '#tests/config/integration/checks/infrastructure/docker.ts';

/** Import one payload file as an image with this tag. */
async function importImage(root: string, tag: string, contents: string | Buffer): Promise<void> {
    await writeFile(join(root, 'payload.pem'), contents);
    const archive = runCommandBlocking(['tar', '-cf', 'payload.tar', 'payload.pem'], { cwd: root });
    if (archive.code !== 0) throw new Error(archive.stderr);
    const imported = runCommandBlocking(['docker', 'import', 'payload.tar', tag], { cwd: root });
    if (imported.code !== 0) throw new Error(imported.stderr);
}

test('Trivy checks each Dockerfile in its deepest scope and honors an ignore limited to a scope path', async () => {
    await using sandbox = await testdir();
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    const settings = buildSandboxSettings(['docker'], { tables: TRIVY_SCOPE_TABLES });
    // Trivy rule DS-0002 reports `USER root`. Use `USER node` to fix it.
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, ROOT_USER_DOCKERFILE])),
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, { 'untracked/Dockerfile': ROOT_USER_DOCKERFILE });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'docker/trivy-config', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(
        failed.checks.map((check) => ({
            scope: check.scope,
            status: check.status,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([...TRIVY_SCOPE_RESULTS]);
    for (const path of ['Dockerfile', 'sibling/Dockerfile'])
        await writeFile(join(sandbox.path, path), ROOT_USER_DOCKERFILE.replace('USER root', 'USER node'));
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
});

test.each([...LEVELS])(
    'Hadolint at level %s checks apt and apk version pins only at level all, and reports a latest tag at both levels, in the root and a scope',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker'], {
                level,
                scopes: [{ path: 'app', configurations: ['docker'] }],
            }),
            Dockerfile: DEBIAN_DOCKERFILE,
            'Dockerfile.alpine': ALPINE_DOCKERFILE,
            'app/Dockerfile': DEBIAN_DOCKERFILE,
            'app/Dockerfile.alpine': ALPINE_DOCKERFILE,
        });

        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        // At level all, Hadolint also asks for version pins in apt and apk installs.
        const pins =
            level === 'all'
                ? ([
                      ['Dockerfile', 'DL3008'],
                      ['Dockerfile.alpine', 'DL3018'],
                  ] as const)
                : [];
        for (const scope of ['', 'app']) {
            const dockerfile = posix.join(scope, 'Dockerfile');
            const result = parseCheckReport(
                await spawnGspot(sandbox.path, [
                    'check',
                    dockerfile,
                    posix.join(scope, 'Dockerfile.alpine'),
                    '--only',
                    'docker/hadolint',
                    '--json',
                ]),
            );
            expect(result.code, result.stdout + result.stderr).toBe(pins.length === 0 ? 0 : 1);
            expect(listFindingRows(result.report)).toStrictEqual(
                pins.map(([file, rule]) => ({ file: posix.join(scope, file), line: 2, rule })),
            );
            await writeFile(join(sandbox.path, dockerfile), DEBIAN_DOCKERFILE.replace('debian:12', 'debian:latest'));
            const unpinned = parseCheckReport(
                await spawnGspot(sandbox.path, ['check', dockerfile, '--only', 'docker/hadolint', '--json']),
            );
            expect(unpinned.code, unpinned.stdout + unpinned.stderr).toBe(1);
            expect(listFindingRows(unpinned.report)).toStrictEqual([
                { file: dockerfile, line: 1, rule: 'DL3007' },
                ...pins
                    .filter(([file]) => file === 'Dockerfile')
                    .map(([, rule]) => ({ file: dockerfile, line: 2, rule })),
            ]);
        }
    },
);

// These Docker checks need the Linux Docker engine.
test.skipIf(!isLinux)(
    'docker/trivy-image reports a private key in an image, errors on a broken config file, and passes a clean image',
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
            'gspot.toml': buildSandboxSettings(['docker']),
            'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
            'payload.pem': privateKey,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const configPath = join(sandbox.path, TRIVY_CONFIG_PATH);
        const configuration = await readFile(configPath, 'utf8');
        const command = ['check', '--only', 'docker/trivy-image', '--json'];
        try {
            await importImage(sandbox.path, tags[0], privateKey);
            await importImage(sandbox.path, tags[1], 'No credentials in this image.\n');
            const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const findings = failed.report.checks.flatMap(({ findings }) => findings);
            expect(findings[0]!.message).not.toContain('BEGIN RSA PRIVATE KEY');
            expect(findings).toMatchObject([
                {
                    file: 'compose.yaml',
                    line: 1,
                    rule: 'secret',
                    message: expect.stringContaining('private-key') as string,
                },
            ]);
            await writeFile(configPath, 'severity: [');
            const broken = parseCheckReport(await spawnGspot(sandbox.path, command));
            expect(broken.code, broken.stdout + broken.stderr).toBe(2);
            expect(broken.report.checks).toMatchObject([
                { status: 'error', note: expect.stringContaining('Trivy could not scan') as string },
            ]);
            await writeFile(configPath, configuration);
            await writeFile(join(sandbox.path, 'compose.yaml'), `services: {app: {image: "${tags[1]}"}}\n`);
            const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        } finally {
            runCommandBlocking(['docker', 'image', 'rm', '--force', ...tags], { cwd: sandbox.path });
        }
    },
);

const installedSandbox = shareInstalledSandbox(DOCKER_SANDBOX);

test.each([...DOCKER_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    const expected =
        'message' in sample.expected
            ? { ...sample.expected, message: expect.stringContaining(sample.expected.message) as string }
            : sample.expected;
    const result = await runCheckSample(installedSandbox(), { ...sample, expected }, DOCKER_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary({ ...sample, expected }));
});
