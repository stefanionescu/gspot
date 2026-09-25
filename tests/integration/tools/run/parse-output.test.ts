import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { planRun } from '#cli/execution/plan.ts';
import { rejects } from 'node:assert/strict';
import { emitAll } from '#cli/generation/targets.ts';
import { expect, test } from 'bun:test';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';

import { engineInput, resolveCheck } from '#cli/execution/engines.ts';
import { isToolBroken, checkedFindings } from '#cli/execution/broken-tool.ts';
import { parseOutput, ToolOutputError } from '#cli/execution/parse-output.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';

test('native image reports distinguish a generated test key, invalid configuration, and a clean image', async () => {
    await using sandbox = await testdir();
    const prefix = `gspot-image-acceptance-${randomUUID()}`;
    const tags = [`${prefix}:defect`, `${prefix}:corrected`];
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
            { file: 'compose.yaml', line: 1, rule: 'image', message: expect.stringContaining('private-key') },
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
    const planned = (await planRun(session, { stage: 'all', only: ['markdown/markdownlint'], skips: [] }))[0]!;
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
        expect(findings).toContainEqual(
            expect.objectContaining({ file, line: 1, column: 6, rule: 'MD033', fixable: false }),
        );
        expect(findings).toContainEqual(expect.objectContaining({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(expect.objectContaining({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    const { manifest: _manifest, ...declared } = planned;
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
        expect(findings).toContainEqual(
            expect.objectContaining({ file: `nested/${path}`, line: 1, column: 6, fixable: true }),
        );
    expect(findings).toContainEqual(
        expect.objectContaining({
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

test('ShellCheck rejects partial findings when another selected file cannot be read', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['bash/shellcheck'] }))[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const roots: [string, string] = [sandbox.path, sandbox.path];
    const broken = Bun.spawnSync([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.exitCode, broken.stderr.toString()).toBe(2);
    expect(broken.stdout.toString()).toContain('SC2086');
    const result = {
        code: broken.exitCode,
        stdout: broken.stdout.toString(),
        stderr: broken.stderr.toString(),
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, roots)).toThrow(ToolOutputError);
    const defect = Bun.spawnSync(command, { cwd: sandbox.path });
    expect(defect.exitCode).toBe(1);
    expect(
        checkedFindings(
            planned,
            { ...result, code: defect.exitCode, stdout: defect.stdout.toString(), stderr: defect.stderr.toString() },
            roots,
        ),
    ).toContainEqual(expect.objectContaining({ file: 'sample.sh', line: 2, rule: 'SC2086' }));
    expect(await Bun.file(join(sandbox.path, 'sample.sh')).text()).toBe(source);
    await Bun.write(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path });
    expect(corrected.exitCode).toBe(0);
    expect(
        checkedFindings(
            planned,
            {
                ...result,
                code: corrected.exitCode,
                stdout: corrected.stdout.toString(),
                stderr: corrected.stderr.toString(),
            },
            roots,
        ),
    ).toStrictEqual([]);
});

test.each(['def broken(:\n', 'value = "\u0000"\n'])(
    'Vulture rejects incomplete analysis of %j even when dead-code findings set exit 3',
    async (brokenSource) => {
        await using sandbox = await testdir();
        const source = 'import os\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["python"]\n',
            'sample.py': source,
            'broken.py': brokenSource,
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'push', skips: [], only: ['python/vulture'] }))[0]!;
        const command = ['vulture', '--min-confidence', '80', 'sample.py', 'broken.py'];
        const roots: [string, string] = [sandbox.path, sandbox.path];
        const broken = Bun.spawnSync(command, { cwd: sandbox.path });
        expect(broken.exitCode, broken.stderr.toString()).toBe(3);
        expect(broken.stdout.toString()).toContain("unused import 'os'");
        const result = {
            code: broken.exitCode,
            stdout: broken.stdout.toString(),
            stderr: broken.stderr.toString(),
            missing: false,
            duration: 1,
        };
        expect(() => checkedFindings(planned, result, roots)).toThrow(ToolOutputError);
        expect(await Bun.file(join(sandbox.path, 'broken.py')).text()).toBe(brokenSource);
        await Bun.write(join(sandbox.path, 'broken.py'), 'print("Ready")\n');
        const defect = Bun.spawnSync(command, { cwd: sandbox.path });
        expect(defect.exitCode).toBe(3);
        expect(
            checkedFindings(
                planned,
                {
                    ...result,
                    code: defect.exitCode,
                    stdout: defect.stdout.toString(),
                    stderr: defect.stderr.toString(),
                },
                roots,
            ),
        ).toContainEqual(
            expect.objectContaining({ file: 'sample.py', line: 1, message: "unused import 'os' (90% confidence)" }),
        );
        expect(await Bun.file(join(sandbox.path, 'sample.py')).text()).toBe(source);
        await Bun.write(join(sandbox.path, 'sample.py'), 'print("Ready")\n');
        const corrected = Bun.spawnSync(command, { cwd: sandbox.path });
        expect(corrected.exitCode).toBe(0);
        expect(
            checkedFindings(
                planned,
                {
                    ...result,
                    code: corrected.exitCode,
                    stdout: corrected.stdout.toString(),
                    stderr: corrected.stderr.toString(),
                },
                roots,
            ),
        ).toStrictEqual([]);
    },
);

test.each(['$/', '"$/', '"\\u0024/', '|- # $comment\n            $/'])(
    'Actionlint accepts self-repository scalar %s while retaining expression errors and source bytes',
    async (prefix) => {
        await using sandbox = await testdir();
        const suffix = prefix.startsWith('"') ? '"' : '';
        const reference = `${prefix}.github/workflows/called.yml${suffix}`;
        const workflow = `name: Caller\non: workflow_dispatch\npermissions: {}\njobs:\n    caller:\n        uses: ${reference}\n        with:\n            greeting: \${{ unknown.value }}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            '.github/workflows/called.yml':
                'name: Called\non:\n    workflow_call:\n        inputs:\n            greeting:\n                type: string\n                required: true\npermissions: {}\njobs:\n    greet:\n        runs-on: ubuntu-latest\n        steps:\n            - run: echo "$GREETING"\n              env:\n                  GREETING: ${{ inputs.greeting }}\n',
            'unrelated.yaml': '42\n',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        const failed = await resolveCheck(planned.spec)(session, planned);
        expect(failed.status, JSON.stringify(failed)).toBe('fail');
        expect(failed.findings).toContainEqual(
            expect.objectContaining({
                file: '.github/workflows/caller.yml',
                rule: 'expression',
                line: prefix.startsWith('|') ? 9 : 8,
            }),
        );
        expect(failed.findings.some((finding) => finding.rule === 'workflow-call')).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        await Bun.write(
            join(sandbox.path, '.github/workflows/caller.yml'),
            workflow.replace('${{ unknown.value }}', 'Hello'),
        );
        const corrected = await openSession(sandbox.path);
        const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'unrelated.yaml')).text()).toBe('42\n');
    },
);

test.each(['$/', '"$/', "'$/", '"\\x24/', '"\\u0024/', '"\\U00000024/', '|-\n          $/', '>-\n          $/'])(
    'Actionlint validates reusable inputs for scalar %s and preserves authored files',
    async (prefix) => {
        await using sandbox = await testdir();
        const quote = prefix.startsWith('"') ? '"' : prefix.startsWith("'") ? "'" : '';
        const workflow = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${prefix}.github/workflows/called.yml${quote}\n`;
        const called =
            'on:\n  workflow_call:\n    inputs:\n      greeting:\n        type: string\n        required: true\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            '.github/workflows/called.yml': called,
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        const failed = await resolveCheck(planned.spec)(session, planned);
        expect(failed.status, JSON.stringify(failed)).toBe('fail');
        expect(failed.findings).toContainEqual(
            expect.objectContaining({
                file: '.github/workflows/caller.yml',
                line: 4,
                column: 11,
                rule: 'workflow-call',
                message: expect.stringContaining('input "greeting" is required'),
            }),
        );
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        await Bun.write(
            join(sandbox.path, '.github/workflows/caller.yml'),
            `${workflow}    with:\n      greeting: Hello\n`,
        );
        const corrected = await openSession(sandbox.path);
        const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
        expect(await Bun.file(join(sandbox.path, '.github/workflows/called.yml')).text()).toBe(called);
    },
);

test('Actionlint resolves a self-repository alias and reports a missing workflow before correction', async () => {
    await using sandbox = await testdir();
    const workflow =
        'on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/.github/workflows/called.yml\njobs:\n  caller:\n    uses: *workflow\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
        '.github/workflows/caller.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
    const failed = await resolveCheck(planned.spec)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('fail');
    expect(failed.findings).toContainEqual(
        expect.objectContaining({
            file: '.github/workflows/caller.yml',
            line: 3,
            column: 13,
            rule: 'workflow-call',
            message: expect.stringContaining('could not read reusable workflow file'),
        }),
    );
    await Bun.write(
        join(sandbox.path, '.github/workflows/called.yml'),
        'on: workflow_call\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n',
    );
    const corrected = await openSession(sandbox.path);
    const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
    expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
});
