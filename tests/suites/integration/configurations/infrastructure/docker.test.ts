import { generateKeyPair, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { LEVELS } from '#cli/config/manifests.ts';
import {
    DEBIAN_DOCKERFILE,
    DOCKER_CASES,
    DOCKER_SANDBOX,
    ROOT_USER_DOCKERFILE,
    TRIVY_SCOPE_RESULTS,
    TRIVY_SCOPE_TABLES,
} from '#tests/config/integration/infrastructure.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isLinux } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

async function importImage(root: string, tag: string, contents: string | Buffer): Promise<void> {
    await writeFile(join(root, 'payload.pem'), contents);
    const archive = runBlockingCommand(['tar', '-cf', 'payload.tar', 'payload.pem'], { cwd: root });
    if (archive.code !== 0) throw new Error(archive.stderr);
    const imported = runBlockingCommand(['docker', 'import', 'payload.tar', tag], { cwd: root });
    if (imported.code !== 0) throw new Error(imported.stderr);
}

test('Trivy checks each Dockerfile in its deepest scope and honors an ignore limited to a scope path', async () => {
    const paths = ['Dockerfile', 'app/Dockerfile', 'app/child/Dockerfile', 'sibling/Dockerfile'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker'], { tables: TRIVY_SCOPE_TABLES }),
        '.gitignore': 'untracked/\n',
        ...Object.fromEntries(paths.map((path) => [path, ROOT_USER_DOCKERFILE])),
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, { 'untracked/Dockerfile': ROOT_USER_DOCKERFILE });
    await applyGeneratedFiles(sandbox.path);
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

test('Trivy reports a password in ENV, which gitleaks does not report', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: `${ROOT_USER_DOCKERFILE}\nENV DB_PASSWORD=hunter2\n`,
    });
    commitAll(sandbox.path);
    await applyGeneratedFiles(sandbox.path);
    const command = ['check', '--only', 'docker/trivy-config', '--json'];
    const { report } = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(JSON.stringify(report.checks)).toContain('DB_PASSWORD');
});

test.each([...LEVELS])(
    'Hadolint at level %s checks apt version pins only at level all, and reports a latest tag at both levels, in the root and a scope',
    async (level) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docker'], {
                level,
                scopes: [{ path: 'app', configurations: ['docker'] }],
            }),
            Dockerfile: DEBIAN_DOCKERFILE,
            'app/Dockerfile': DEBIAN_DOCKERFILE,
        });

        await applyGeneratedFiles(sandbox.path);
        const pins = level === 'all' ? ([['Dockerfile', 'DL3008']] as const) : [];
        for (const scope of ['', 'app']) {
            const dockerfile = posix.join(scope, 'Dockerfile');
            const result = parseCheckReport(
                await spawnGspot(sandbox.path, ['check', dockerfile, '--only', 'docker/hadolint', '--json']),
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
                ...pins.map(([, rule]) => ({ file: dockerfile, line: 2, rule })),
            ]);
        }
    },
);

test.skipIf(!isLinux || Bun.which('docker') === null)(
    'docker/trivy-image reports a private key in an image, errors on a broken config file, and passes a clean image',
    async () => {
        const prefix = `gspot-tools-image-${randomUUID()}`;
        const tags = [`${prefix}:defect`, `${prefix}:corrected`] as const;
        const { privateKey: key } = await promisify(generateKeyPair)('rsa', { modulusLength: 2048 });
        const privateKey = key.export({
            type: 'pkcs1',
            format: 'pem',
        });
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['docker']),
            'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
            'payload.pem': privateKey,
        });
        await applyGeneratedFiles(sandbox.path);
        const configPath = join(sandbox.path, getManifestTarget('docker', 'trivy.yml'));
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
            runBlockingCommand(['docker', 'image', 'rm', '--force', ...tags], { cwd: sandbox.path });
        }
    },
);

const installedSandbox = shareInstalledSandbox(DOCKER_SANDBOX);

test.each([...DOCKER_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    const expected =
        'message' in sample.expected
            ? { ...sample.expected, message: expect.stringContaining(sample.expected.message) as string }
            : sample.expected;
    await assertCheckSample(installedSandbox(), { ...sample, expected });
});
