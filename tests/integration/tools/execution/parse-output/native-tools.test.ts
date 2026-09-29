import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { renameSync, writeFileSync } from 'node:fs';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { parseOutput } from '#cli/execution/output/parse.ts';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { isToolBroken, checkedFindings } from '#cli/execution/broken-tool.ts';

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
            'gspot.toml': 'version = 1\nkits = ["docker"]\n',
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
                { file: 'compose.yaml', line: 1, rule: 'image', message: textContaining('private-key') },
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

test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.md', ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md'])];
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nkits = ["markdown"]\n[tools.markdownlint.rules]\ndefault = false\nMD009 = true\nMD033 = true\nMD041 = true\n',
        ...Object.fromEntries(paths.map((path) => [path, 'café <span>Content</span>   \n'])),
    });
    const session = await openSession(sandbox.path);
    const configuration = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
    await Bun.write(join(sandbox.path, configuration.path), configuration.content);
    const plans = planRun(session, { stage: 'all', only: ['markdown/markdownlint'], skips: [] });
    const planned = plans[0]!;
    const command = [
        'markdownlint-cli2',
        '--no-globs',
        '--config',
        configuration.path,
        ...paths.map((path) => `:${path}`),
    ];
    const failed = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    const findings = parseOutput(planned.spec, failed.stdout.toString(), failed.stderr.toString(), sandbox.path);
    for (const file of paths) {
        expect(findings).toContainEqual(containing({ file, line: 1, column: 6, rule: 'MD033', fixable: false }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    const declared = { ...planned };
    delete declared.manifest;
    const result = { stdout: failed.stdout.toString(), stderr: '', code: 1, missing: false, duration: 1 };
    for (const check of [planned, declared]) {
        expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toStrictEqual(findings);
        expect(() => checkedFindings(check, { ...result, code: 2 }, [sandbox.path, sandbox.path])).toThrow(GspotError);
        expect(() => checkedFindings(check, { ...result, stdout: '[]' }, [sandbox.path, sandbox.path])).toThrow(
            GspotError,
        );
    }
    for (const path of paths) await Bun.write(join(sandbox.path, path), '# Title\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(parseOutput(planned.spec, corrected.stdout.toString(), '', sandbox.path)).toStrictEqual([]);
});

test('native forbidden spelling reports null corrections as a non-fixable finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'native.toml': '[default.extend-words]\nforbidden = ""\n',
        'sample.txt': 'forbidden\n',
    });
    const spec = kitManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const command = ['typos', '--isolated', '--config', 'native.toml', '--format', 'json', 'sample.txt'];
    const failed = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(failed.exitCode, failed.stderr.toString()).toBe(2);
    expect(parseOutput(spec, failed.stdout.toString(), failed.stderr.toString(), sandbox.path)).toMatchObject([
        { file: 'sample.txt', line: 1, column: 1, fixable: false, message: '`forbidden` is not allowed' },
    ]);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'permitted\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(parseOutput(spec, corrected.stdout.toString(), corrected.stderr.toString(), sandbox.path)).toStrictEqual([]);
});

test('native spelling JSON retains filename delimiters and Unicode character columns', async () => {
    await using sandbox = await testdir();
    const paths = [
        'space name.txt',
        'teh.txt',
        ...(process.platform === 'win32' ? [] : ['name:part.txt', 'line\nbreak.txt']),
    ];
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [`nested/${path}`, 'café teh\n'])));
    const spec = kitManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const cwd = join(sandbox.path, 'nested');
    const native = Bun.spawnSync(['typos', '--isolated', '--format', 'json', ...paths], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(native.exitCode, native.stderr.toString()).toBe(2);
    const findings = parseOutput(spec, native.stdout.toString(), native.stderr.toString(), sandbox.path, cwd);
    for (const path of paths)
        expect(findings).toContainEqual(containing({ file: `nested/${path}`, line: 1, column: 6, fixable: true }));
    expect(findings).toContainEqual(
        containing({
            file: 'nested/teh.txt',
            message: 'Filename: `teh` should be `the`',
            fixable: false,
        }),
    );
    expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
    for (const path of paths) await Bun.write(join(cwd, path), 'café the\n');
    renameSync(join(cwd, 'teh.txt'), join(cwd, 'the.txt'));
    const corrected = Bun.spawnSync(
        ['typos', '--isolated', '--format', 'json', ...paths.map((path) => (path === 'teh.txt' ? 'the.txt' : path))],
        {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 30_000,
        },
    );
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(
        parseOutput(spec, corrected.stdout.toString(), corrected.stderr.toString(), sandbox.path, cwd),
    ).toStrictEqual([]);
});
