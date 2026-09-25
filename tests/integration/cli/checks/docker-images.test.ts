import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import * as tools from '#cli/execution/tool-runner.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';

const sources = [
    'services:\n  app:\n    image: "nginx:1.27.2"\n',
    'services: {app: {image: nginx:1.27.2}}\n',
    'services:\n  app:\n    image: >-\n      nginx:1.27.2\n',
    'x-base: &base\n  image: nginx:1.27.2\nservices:\n  app:\n    <<: *base\n',
    'x-example: {image: unrelated:1}\nservices: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "${IMAGE}"}, local: {build: .}}\n',
];

test('Compose images follow service mappings and reject unreadable input', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["docker"]\n',
        'compose.yaml': sources[0]!,
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('docker')!.checks.find((check) => check.name === 'docker/trivy-image')!;
    const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
    const run = spyOn(tools, 'runCheckCommand').mockResolvedValue({
        code: 10,
        missing: false,
        duration: 1,
        stdout: JSON.stringify({
            SchemaVersion: 2,
            ArtifactName: 'nginx:1.27.2',
            Results: [{ Target: 'nginx', Vulnerabilities: [{ VulnerabilityID: 'CVE-example', PkgName: 'example' }] }],
        }),
        stderr: '',
    });
    try {
        for (const source of sources) {
            writeFileSync(join(directory.path, 'compose.yaml'), source);
            input.observations = { root: directory.path, sources: new Map() };
            run.mockClear();
            expect(await trivyImage(input)).toStrictEqual([
                {
                    check: 'docker/trivy-image',
                    file: 'compose.yaml',
                    line: 1,
                    rule: 'image',
                    message: 'nginx:1.27.2: CVE-example (example)',
                    fixable: false,
                },
            ]);
            expect(run.mock.calls.map(([, command]) => command.at(-1))).toStrictEqual(['nginx:1.27.2']);
        }
        const validReport = JSON.stringify({
            SchemaVersion: 2,
            ArtifactName: 'nginx:1.27.2',
            Results: [{ Target: 'nginx', Vulnerabilities: [{ VulnerabilityID: 'CVE-example', PkgName: 'example' }] }],
        });
        for (const failure of [
            { code: 1, stdout: validReport, stderr: 'FATAL registry authentication failed' },
            { code: 0, stdout: '', stderr: '' },
            { code: 10, stdout: '{', stderr: '' },
            { code: 10, stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2"}', stderr: '' },
            { code: 0, stdout: validReport, stderr: '' },
            { code: 10, stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{}]}', stderr: '' },
        ]) {
            run.mockResolvedValue({ ...failure, missing: false, duration: 1 });
            await expect(trivyImage(input)).rejects.toThrow();
            expect(await Bun.file(join(directory.path, 'compose.yaml')).text()).toBe(sources.at(-1)!);
        }
        run.mockResolvedValue({
            code: 0,
            missing: false,
            duration: 1,
            stdout: JSON.stringify({ SchemaVersion: 2, ArtifactName: 'nginx:1.27.2' }),
            stderr: '',
        });
        expect(await trivyImage(input)).toStrictEqual([]);
        for (const invalid of ['services: [', 'services: {app: {image: 12}}', 'services: {app: null}']) {
            writeFileSync(join(directory.path, 'compose.yaml'), invalid);
            input.observations = { root: directory.path, sources: new Map() };
            run.mockClear();
            await expect(trivyImage(input)).rejects.toThrow('Cannot read Compose service images in compose.yaml.');
            expect(run).not.toHaveBeenCalled();
        }
        writeFileSync(join(directory.path, 'compose.yaml'), 'services: {app: {build: .}}\n');
        input.observations = { root: directory.path, sources: new Map() };
        expect(await trivyImage(input)).toStrictEqual([]);
        expect(run).not.toHaveBeenCalled();
    } finally {
        run.mockRestore();
    }
});
