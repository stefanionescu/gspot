import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { CheckSpec } from '#cli/types/configurations.ts';
import { isToolBroken, checkedFindings } from '#cli/run/broken-tool.ts';
import { planRun } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';
import { parseOutput, ToolOutputError } from '#cli/run/parse-output.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { emitAll } from '#cli/emit/targets.ts';

describe('tool output across platforms', () => {
    test('native Markdown JSON preserves filename delimiters, positions, and fixability', async () => {
        await using sandbox = await testdir();
        const paths = ['space name.md', ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md'])];
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["markdown"]\n[tools.markdownlint.rules]\ndefault = false\nMD009 = true\nMD033 = true\nMD041 = true\n',
            ...Object.fromEntries(paths.map((path) => [path, 'café <span>Content</span>   \n'])),
        });
        const session = await openSession(sandbox.path);
        const configuration = emitAll(session).files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
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
            expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toEqual(findings);
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
        expect(parseOutput(planned.spec, corrected.stdout.toString(), '', sandbox.path)).toEqual([]);
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
        expect(parseOutput(spec, corrected.stdout.toString(), corrected.stderr.toString(), sandbox.path)).toEqual([]);
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
            expect(checkedFindings(check, { ...result, stdout: '', code: 0 }, [sandbox.path, sandbox.path])).toEqual(
                [],
            );
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
    expect(findings).toEqual([
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

test.each(['javascript', 'typescript'].flatMap((configuration) => ['recommended', 'all'].map((level) => ({ configuration, level }))))(
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
    expect(parseOutput(spec, '[]', '', '/repo')).toEqual([]);
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
