import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { planRun } from '#cli/execution/planning/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { parseOutput } from '#cli/execution/output/parse.ts';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import { ToolOutputError } from '#cli/execution/output/tool-formats.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { checkedFindings, isToolBroken } from '#cli/execution/broken-tool.ts';

test('native image reports distinguish a generated test key, invalid configuration, and a clean image', async () => {
    await using sandbox = await testdir();
    const prefix = `gspot-image-acceptance-${randomUUID()}`;
    const tags = [`${prefix}:defect`, `${prefix}:corrected`] as const;
    const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
        type: 'pkcs1',
        format: 'pem',
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["docker"]\n',
        'compose.yaml': `services: {app: {image: "${tags[0]}"}}\n`,
        'payload.pem': privateKey,
        '.gspot/config/trivy.yaml': 'severity: [HIGH, CRITICAL]\n',
    });
    const session = await openSession(sandbox.path);
    const spec = session.manifests.get('docker')!.checks.find((entry) => entry.name === 'docker/trivy-image')!;
    const input = engineInput(session, { scope: session.scopes[0]!, spec, files: session.repository.files });
    try {
        for (const [index, tag] of tags.entries()) {
            if (index === 1) await Bun.write(join(sandbox.path, 'payload.pem'), 'No credentials in this image.\n');
            const archive = Bun.spawnSync(['tar', '-cf', '-', 'payload.pem'], { cwd: sandbox.path });
            expect(archive.exitCode, archive.stderr.toString()).toBe(0);
            const imported = Bun.spawnSync(['docker', 'import', '-', tag], { stdin: archive.stdout });
            expect(imported.exitCode, imported.stderr.toString()).toBe(0);
        }
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
        expect(
            await trivyImage(
                engineInput(corrected, {
                    scope: corrected.scopes[0]!,
                    spec,
                    files: corrected.repository.files,
                }),
            ),
        ).toStrictEqual([]);
    } finally {
        for (const tag of tags) Bun.spawnSync(['docker', 'image', 'rm', '--force', tag]);
    }
}, 120_000);

test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.md', ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md'])];
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["markdown"]\n[tools.markdownlint.rules]\ndefault = false\nMD009 = true\nMD033 = true\nMD041 = true\n',
        ...Object.fromEntries(paths.map((path) => [path, 'café <span>Content</span>   \n'])),
    });
    const session = await openSession(sandbox.path);
    const configuration = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
    await Bun.write(join(sandbox.path, configuration.path), configuration.content);
    const plans = await planRun(session, { stage: 'all', only: ['markdown/markdownlint'], skips: [] });
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
        expect(() => checkedFindings(check, { ...result, code: 2 }, [sandbox.path, sandbox.path])).toThrow(
            ToolOutputError,
        );
        expect(() => checkedFindings(check, { ...result, stdout: '[]' }, [sandbox.path, sandbox.path])).toThrow(
            ToolOutputError,
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
    const spec = configurationManifests()
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
    const spec = configurationManifests()
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
