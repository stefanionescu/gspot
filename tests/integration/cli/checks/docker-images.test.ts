import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import * as tools from '#cli/run/tool-runner.ts';

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
        'gspot.toml': 'version = 1\npresets = ["docker"]\n',
        'compose.yaml': sources[0]!,
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('docker')!.checks.find((check) => check.name === 'docker/trivy-image')!;
    const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
    const run = spyOn(tools, 'runCheckCommand').mockResolvedValue({
        code: 1, missing: false, duration: 1, stdout: 'CVE-example', stderr: '',
    });
    try {
        for (const source of sources) {
            writeFileSync(join(directory.path, 'compose.yaml'), source);
            run.mockClear();
            expect(await trivyImage(input)).toEqual([{
                check: 'docker/trivy-image', file: 'compose.yaml', line: 1,
                rule: 'image', message: 'nginx:1.27.2: CVE-example', fixable: false,
            }]);
            expect(run.mock.calls.map(([, command]) => command.at(-1))).toEqual(['nginx:1.27.2']);
        }
        run.mockResolvedValue({ code: 0, missing: false, duration: 1, stdout: '', stderr: '' });
        expect(await trivyImage(input)).toEqual([]);
        for (const invalid of ['services: [', 'services: {app: {image: 12}}', 'services: {app: null}']) {
            writeFileSync(join(directory.path, 'compose.yaml'), invalid);
            run.mockClear();
            await expect(trivyImage(input)).rejects.toThrow('Cannot read Compose service images in compose.yaml.');
            expect(run).not.toHaveBeenCalled();
        }
        writeFileSync(join(directory.path, 'compose.yaml'), 'services: {app: {build: .}}\n');
        expect(await trivyImage(input)).toEqual([]);
        expect(run).not.toHaveBeenCalled();
    } finally {
        run.mockRestore();
    }
});
