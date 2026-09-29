import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as tools from '#cli/execution/tool/runner.ts';
import type { EngineInput } from '#cli/types/checks.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { test, spyOn, expect, type Mock } from 'bun:test';
import { rejection } from '#tests/support/expectations.ts';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';

const sources = [
    'services:\n  app:\n    image: "nginx:1.27.2"\n',
    'services: {app: {image: nginx:1.27.2}}\n',
    'services:\n  app:\n    image: >-\n      nginx:1.27.2\n',
    'x-base: &base\n  image: nginx:1.27.2\nservices:\n  app:\n    <<: *base\n',
    'x-example: {image: unrelated:1}\nservices: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "${IMAGE}"}, local: {build: .}}\n',
];

const VALID_REPORT = JSON.stringify({
    SchemaVersion: 2,
    ArtifactName: 'nginx:1.27.2',
    Results: [{ Target: 'nginx', Vulnerabilities: [{ VulnerabilityID: 'CVE-example', PkgName: 'example' }] }],
});

// Compose syntax variants identify only service images and scan each image once.
async function expectServiceImages(input: EngineInput, run: Mock<typeof tools.runCheckCommand>): Promise<void> {
    for (const source of sources) {
        writeFileSync(join(input.root, 'compose.yaml'), source);
        input.reads = { root: input.root, sources: new Map() };
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
}

// Native scan failures reject the report before a corrected report is accepted.
async function expectScanReports(input: EngineInput, run: Mock<typeof tools.runCheckCommand>): Promise<void> {
    for (const failure of [
        { code: 1, stdout: VALID_REPORT, stderr: 'FATAL registry authentication failed' },
        { code: 0, stdout: '', stderr: '' },
        { code: 10, stdout: '{', stderr: '' },
        { code: 10, stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2"}', stderr: '' },
        { code: 0, stdout: VALID_REPORT, stderr: '' },
        { code: 10, stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{}]}', stderr: '' },
    ]) {
        run.mockResolvedValue({ ...failure, missing: false, duration: 1 });
        await rejection(trivyImage(input));
        expect(await Bun.file(join(input.root, 'compose.yaml')).text()).toBe(sources.at(-1)!);
    }
    run.mockResolvedValue({
        code: 0,
        missing: false,
        duration: 1,
        stdout: JSON.stringify({ SchemaVersion: 2, ArtifactName: 'nginx:1.27.2' }),
        stderr: '',
    });
    expect(await trivyImage(input)).toStrictEqual([]);
}

// Malformed mappings fail before the native scan and build-only services need no scan.
async function expectUnreadableCompose(input: EngineInput, run: Mock<typeof tools.runCheckCommand>): Promise<void> {
    for (const invalid of ['services: [', 'services: {app: {image: 12}}', 'services: {app: null}']) {
        writeFileSync(join(input.root, 'compose.yaml'), invalid);
        input.reads = { root: input.root, sources: new Map() };
        run.mockClear();
        expect(await rejection(trivyImage(input))).toContain('Cannot read Compose service images in compose.yaml.');
        expect(run).not.toHaveBeenCalled();
    }
    writeFileSync(join(input.root, 'compose.yaml'), 'services: {app: {build: .}}\n');
    input.reads = { root: input.root, sources: new Map() };
    expect(await trivyImage(input)).toStrictEqual([]);
    expect(run).not.toHaveBeenCalled();
}

test.each([
    { scenario: 'discovers service images', verify: expectServiceImages },
    { scenario: 'validates native reports', verify: expectScanReports },
    { scenario: 'rejects malformed service mappings', verify: expectUnreadableCompose },
])('Compose image scanning $scenario', async ({ verify }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nkits = ["docker"]\n',
        'compose.yaml': sources.at(-1)!,
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('docker')!.checks.find((check) => check.name === 'docker/trivy-image')!;
    const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
    const run = spyOn(tools, 'runCheckCommand').mockResolvedValue({
        code: 10,
        missing: false,
        duration: 1,
        stdout: VALID_REPORT,
        stderr: '',
    });
    try {
        expect(await trivyImage(input)).toMatchObject([{ file: 'compose.yaml', rule: 'image' }]);
        await verify(input, run);
    } finally {
        run.mockRestore();
    }
});
