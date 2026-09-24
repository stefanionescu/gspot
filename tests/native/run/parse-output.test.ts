import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { rejects } from 'node:assert/strict';
import { emitAll } from '#cli/emit/targets.ts';
import { describe, expect, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { engineInput, resolveCheck } from '#cli/run/engines.ts';
import { isToolBroken, checkedFindings } from '#cli/run/broken-tool.ts';
import { parseOutput, ToolOutputError } from '#cli/run/parse-output.ts';
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

describe('tool output across platforms', () => {
    test.each([
        '403 API rate limit exceeded',
        '429 Too Many Requests',
        '503 Service Unavailable',
        'dial tcp: no such host',
    ])('pin verification treats %s as an execution error and accepts a completed observation', async (failure) => {
        await using sandbox = await testdir();
        const workflow = 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/check.yml': workflow,
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'push', skips: [], only: ['configs/actions-pins'] }))[0]!;
        const result = {
            code: 1,
            stdout: '',
            stderr: `ERROR failed to handle a line: GET https://api.github.com/repos/actions/checkout/commits/v4: ${failure}`,
            missing: false,
            duration: 1,
        };
        expect(() => checkedFindings(planned, result, [sandbox.path, sandbox.path])).toThrow(ToolOutputError);
        expect(
            checkedFindings(planned, { ...result, stderr: 'invalid action pin: .github/workflows/check.yml:4' }, [
                sandbox.path,
                sandbox.path,
            ]),
        ).toStrictEqual([
            expect.objectContaining({
                check: 'configs/actions-pins',
                message: 'invalid action pin: .github/workflows/check.yml:4',
            }),
        ]);
        expect(
            checkedFindings(planned, { ...result, code: 0, stderr: '' }, [sandbox.path, sandbox.path]),
        ).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
    });

    test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
        await using sandbox = await testdir();
        const paths = ['space name.md', ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md'])];
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["markdown"]\n[tools.markdownlint.rules]\ndefault = false\nMD009 = true\nMD033 = true\nMD041 = true\n',
            ...Object.fromEntries(paths.map((path) => [path, 'café <span>Content</span>   \n'])),
        });
        const session = await openSession(sandbox.path);
        const configuration = emitAll(session).files.find(
            ({ path }) => path === '.gspot/config/markdownlint-cli2.mjs',
        )!;
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

    test('invalid Markdown records remain execution errors and valid records parse', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
        const spec = configurationManifests()
            .get('markdown')!
            .checks.find(({ name }) => name === 'markdown/markdownlint')!;
        const valid = {
            fileName: 'sample.md',
            lineNumber: 1,
            ruleNames: ['MD033'],
            ruleDescription: 'Inline HTML',
            errorDetail: 'Element: span',
            errorContext: null,
            errorRange: [1, 6],
            fixInfo: null,
            severity: 'error',
        };
        for (const stdout of [
            '',
            'not JSON',
            '{}',
            JSON.stringify([{ ...valid, ruleNames: [] }]),
            JSON.stringify([{ ...valid, errorRange: [999, 1] }]),
            JSON.stringify([{ ...valid, lineNumber: 999 }]),
            JSON.stringify([{ ...valid, fileName: '../outside.md' }]),
            JSON.stringify([{ ...valid, fixInfo: [] }]),
        ])
            expect(() => parseOutput(spec, stdout, '', sandbox.path)).toThrow(ToolOutputError);
        expect(parseOutput(spec, JSON.stringify([valid]), '', sandbox.path)).toMatchObject([
            { file: 'sample.md', rule: 'MD033', fixable: false },
        ]);
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
        expect(parseOutput(spec, corrected.stdout.toString(), corrected.stderr.toString(), sandbox.path)).toStrictEqual(
            [],
        );
    });
    test('spelling distinguishes native findings from fatal exits for configuration and declared checks', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n',
            'sample.txt': 'teh\n',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'all', only: ['spelling/typos'], skips: [] }))[0]!;
        const { manifest: _manifest, ...declared } = planned;
        const stdout = JSON.stringify({
            type: 'typo',
            path: 'sample.txt',
            line_num: 1,
            byte_offset: 0,
            typo: 'teh',
            corrections: ['the'],
        });
        const result = { stdout, stderr: '', code: 2, missing: false, duration: 1 };
        for (const check of [planned, declared]) {
            expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toMatchObject([
                { file: 'sample.txt' },
            ]);
            expect(() =>
                checkedFindings(check, { ...result, code: 78, stderr: 'Invalid native configuration.' }, [
                    sandbox.path,
                    sandbox.path,
                ]),
            ).toThrow(ToolOutputError);
            expect(() => checkedFindings(check, { ...result, stdout: '' }, [sandbox.path, sandbox.path])).toThrow(
                ToolOutputError,
            );
            expect(
                checkedFindings(check, { ...result, stdout: '', code: 0 }, [sandbox.path, sandbox.path]),
            ).toStrictEqual([]);
        }
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
    });

    test.each([
        '{',
        JSON.stringify({ type: 'typo', path: 'sample.txt', typo: 'teh' }),
        JSON.stringify({ type: 'error', message: 'Read failed.' }),
        JSON.stringify({
            type: 'typo',
            path: '../outside.txt',
            line_num: 1,
            byte_offset: 0,
            typo: 'teh',
            corrections: ['the'],
        }),
        JSON.stringify({
            type: 'typo',
            path: 'sample.txt',
            line_num: 1,
            byte_offset: 99,
            typo: 'teh',
            corrections: ['the'],
        }),
    ])('invalid spelling output %s is an execution error', async (stdout) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'sample.txt': 'teh\n' });
        const spec = configurationManifests()
            .get('spelling')!
            .checks.find((check) => check.name === 'spelling/typos')!;
        expect(() => parseOutput(spec, stdout, '', sandbox.path)).toThrow(ToolOutputError);
        const corrected = JSON.stringify({
            type: 'typo',
            path: 'sample.txt',
            line_num: 1,
            byte_offset: 0,
            typo: 'teh',
            corrections: ['the'],
        });
        expect(parseOutput(spec, corrected, '', sandbox.path)).toMatchObject([
            { file: 'sample.txt', line: 1, column: 1 },
        ]);
    });

    test('ShellCheck diagnostics retain their path, position, and rule with either line ending', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/café build.sh': 'echo $1\n' });
        const spec = configurationManifests()
            .get('bash')!
            .checks.find((check) => check.name === 'bash/shellcheck')!;
        const path = join('scripts', 'café build.sh');
        for (const ending of ['\n', '\r\n']) {
            const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
            const findings = parseOutput(spec, '', output, sandbox.path);
            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
            expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
        }
    });

    test('XML diagnostics with carriage returns remain findings on real files', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'settings/feed.xml': '<feed><entry></feed>\n' });
        const spec = configurationManifests()
            .get('configs')!
            .checks.find((check) => check.name === 'configs/xml')!;
        const findings = parseOutput(
            spec,
            '',
            'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n',
            sandbox.path,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/feed.xml', line: 1 });
        expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
    });

    test('Taplo reports one finding from a diff, a log entry, or both', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
        const spec = configurationManifests()
            .get('configs')!
            .checks.find((check) => check.name === 'configs/toml-format')!;
        const path = join(sandbox.path, 'settings', 'café.toml');
        const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
        const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
        for (const [stdout, stderr] of [
            [diff, 'INFO loaded configuration\n'],
            ['', log],
            [diff, log],
        ]) {
            const findings = parseOutput(spec, stdout!, stderr!, sandbox.path);
            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
            expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
        }
    });

    test('grouped output strips line endings and relativizes native absolute paths', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
        const base = configurationManifests()
            .get('configs')!
            .checks.find((check) => check.name === 'configs/toml-format')!;
        const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
        const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
        const findings = parseOutput(spec, output, '', sandbox.path);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
    });
});

test('a syntax diagnostic cannot promise an automatic fix when its check has no fixer', () => {
    const spec = configurationManifests()
        .get('configs')!
        .checks.find((check) => check.name === 'configs/toml')!;
    const findings = parseOutput(spec, '', '  ┌─ settings.toml:2:1\n', '/repository');
    expect(findings).toStrictEqual([
        {
            check: 'configs/toml',
            file: 'settings.toml',
            line: 2,
            column: 1,
            message: 'The file does not parse as TOML.',
            help: 'Fix the line taplo names.',
            fixable: false,
        },
    ]);
});

test.each(
    ['javascript', 'typescript'].flatMap((configuration) =>
        ['recommended', 'all'].map((level) => ({ configuration, level })),
    ),
)(
    '$configuration at $level keeps source text naming module errors as an ESLint finding',
    async ({ configuration, level }) => {
        await using sandbox = await testdir();
        const extension = configuration === 'javascript' ? 'js' : 'ts';
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["${configuration}"]\n`,
            [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'all', skips: [], only: [`${configuration}/eslint`] }))[0]!;
        const stdout = JSON.stringify([
            {
                filePath: join(sandbox.path, path),
                source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
                messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
            },
        ]);
        const result = { stdout, stderr: '', code: 1, missing: false, duration: 1 };
        expect(checkedFindings(planned, result, [sandbox.path, sandbox.path])).toMatchObject([
            { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
        ]);
        expect(() =>
            checkedFindings(planned, { ...result, code: 2, stderr: 'ConfigError: invalid configuration' }, [
                sandbox.path,
                sandbox.path,
            ]),
        ).toThrow(ToolOutputError);
        expect(() =>
            checkedFindings(
                planned,
                { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
                [sandbox.path, sandbox.path],
            ),
        ).toThrow('ERR_MODULE_NOT_FOUND: plugin');
    },
);

test.each([
    '',
    'not JSON',
    '[',
    '{}',
    '[{"filePath":"/repo/a.js","messages":null}]',
    '[{"filePath":"/repo/a.js","messages":[{"message":"partial"}]}]',
])('malformed ESLint output fails instead of becoming empty findings: %s', (text) => {
    const spec = configurationManifests()
        .get('javascript')!
        .checks.find((check) => check.name === 'javascript/eslint')!;
    expect(() => parseOutput(spec, text, '', '/repo')).toThrow(ToolOutputError);
    expect(parseOutput(spec, '[]', '', '/repo')).toStrictEqual([]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    ['C:\\repo', 'C:\\repo\\café file.js', 'café file.js'],
])('ESLint locations respect the root boundary %s for %s', (root, path, expected) => {
    const spec = configurationManifests()
        .get('javascript')!
        .checks.find((check) => check.name === 'javascript/eslint')!;
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(spec, stdout, '', root)).toMatchObject([{ file: expected, line: 1, column: 2 }]);
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
