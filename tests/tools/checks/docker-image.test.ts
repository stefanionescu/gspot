import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { trivyImage } from '#cli/checks/tool/docker.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';

// Each tag owns an explicit payload, so a clean image never depends on loop position.
function importImage(root: string, tag: string, payload: string | Buffer): void {
    writeFileSync(join(root, 'payload.pem'), payload);
    const archive = runTestCommandBlocking(['tar', '-cf', 'payload.tar', 'payload.pem'], { cwd: root });
    if (archive.code !== 0) throw new Error(archive.stderr);
    const imported = runTestCommandBlocking(['docker', 'import', 'payload.tar', tag], {
        cwd: root,
    });
    if (imported.code !== 0) throw new Error(imported.stderr);
}

test.skipIf(!hasLinuxDocker())(
    'native image reports distinguish a generated test key, invalid configuration, and a clean image',
    async () => {
        await using sandbox = await testdir();
        const prefix = `gspot-tools-image-${randomUUID()}`;
        const tags = [`${prefix}:defect`, `${prefix}:corrected`] as const;
        const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
            type: 'pkcs1',
            format: 'pem',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['docker']),
            'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
            'payload.pem': privateKey,
            '.gspot/config/trivy.yml': 'severity: [HIGH, CRITICAL]\n',
        });
        const session = await openSession(sandbox.path);
        const spec = session.manifests.get('docker')!.checks.find((entry) => entry.name === 'docker/trivy-image')!;
        const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
        try {
            importImage(sandbox.path, tags[0], privateKey);
            importImage(sandbox.path, tags[1], 'No credentials in this image.\n');
            const findings = await trivyImage(input);
            expect(findings[0]!.message).not.toContain('BEGIN RSA PRIVATE KEY');
            expect(findings).toMatchObject([
                { file: 'compose.yaml', line: 1, rule: 'vulnerability', message: textContaining('private-key') },
            ]);
            await Bun.write(join(sandbox.path, '.gspot/config/trivy.yml'), 'severity: [');
            expect(await rejection(trivyImage(input))).toContain('Trivy could not scan');
            await Bun.write(join(sandbox.path, '.gspot/config/trivy.yml'), 'severity: [HIGH, CRITICAL]\n');
            await Bun.write(join(sandbox.path, 'compose.yaml'), `services: {app: {image: "${tags[1]}"}}\n`);
            const corrected = await openSession(sandbox.path);
            const files = corrected.repository.files;
            expect(
                await trivyImage(engineInput(corrected, { scope: corrected.scopes[0]!, spec, files })),
            ).toStrictEqual([]);
        } finally {
            runTestCommandBlocking(['docker', 'image', 'rm', '--force', ...tags], { cwd: sandbox.path });
        }
    },
);
