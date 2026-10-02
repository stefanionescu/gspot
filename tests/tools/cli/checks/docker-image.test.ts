import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { textContaining } from '#tests/harness/expectations.ts';
import { trivyImage } from '#cli/checks/tool/docker/trivy-image.ts';

// Imports the payload of the sandbox as each tag in turn; the second import gets a payload without credentials.
function importImages(sandbox: string, tags: readonly string[]): void {
    for (const [index, tag] of tags.entries()) {
        if (index === 1) writeFileSync(join(sandbox, 'payload.pem'), 'No credentials in this image.\n');
        const archive = Bun.spawnSync(['tar', '-cf', '-', 'payload.pem'], { cwd: sandbox });
        if (archive.exitCode !== 0) throw new Error(archive.stderr.toString());
        const imported = Bun.spawnSync(['docker', 'import', '-', tag], { stdin: archive.stdout });
        if (imported.exitCode !== 0) throw new Error(imported.stderr.toString());
    }
}

// A Windows Docker daemon runs Windows containers, which the Linux image cannot use.
describe.if(Bun.which('docker') !== null && process.platform !== 'win32')('with docker', () => {
    test('native image reports distinguish a generated test key, invalid configuration, and a clean image', async () => {
        await using sandbox = await testdir();
        const prefix = `gspot-image-acceptance-${randomUUID()}`;
        const tags = [`${prefix}:defect`, `${prefix}:corrected`] as const;
        const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
            type: 'pkcs1',
            format: 'pem',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['docker']),
            'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
            'payload.pem': privateKey,
            '.gspot/config/trivy.yaml': 'severity: [HIGH, CRITICAL]\n',
        });
        const session = await openSession(sandbox.path);
        const spec = session.manifests.get('docker')!.checks.find((entry) => entry.name === 'docker/trivy-image')!;
        const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
        try {
            importImages(sandbox.path, tags);
            const findings = await trivyImage(input);
            expect(findings[0]!.message).not.toContain('BEGIN RSA PRIVATE KEY');
            expect(findings).toMatchObject([
                { file: 'compose.yaml', line: 1, rule: 'vulnerability', message: textContaining('private-key') },
            ]);
            await Bun.write(join(sandbox.path, '.gspot/config/trivy.yaml'), 'severity: [');
            await rejects(trivyImage(input), /Trivy could not scan/u);
            expect(await Bun.file(join(sandbox.path, 'compose.yaml')).text()).toBe(
                `services: {app: {image: "${tags[0]}"}}\n`,
            );
            await Bun.write(join(sandbox.path, '.gspot/config/trivy.yaml'), 'severity: [HIGH, CRITICAL]\n');
            await Bun.write(join(sandbox.path, 'compose.yaml'), `services: {app: {image: "${tags[1]}"}}\n`);
            const corrected = await openSession(sandbox.path);
            const files = corrected.repository.files;
            expect(
                await trivyImage(engineInput(corrected, { scope: corrected.scopes[0]!, spec, files })),
            ).toStrictEqual([]);
        } finally {
            for (const tag of tags) Bun.spawnSync(['docker', 'image', 'rm', '--force', tag]);
        }
    }, 120_000);
});
