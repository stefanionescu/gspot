import { planRun } from '#cli/execution/plan.ts';
import { join } from 'node:path';

import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import type { CheckSpec } from '#cli/configurations/schema.ts';

import { configurationManifests } from '#cli/configurations/manifests.ts';
import { checkedFindings, isToolBroken } from '#cli/execution/broken-tool.ts';
import { parseOutput, ToolOutputError } from '#cli/execution/output/parse.ts';
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
    expect(checkedFindings(planned, { ...result, code: 0, stderr: '' }, [sandbox.path, sandbox.path])).toStrictEqual(
        [],
    );
    expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
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
        expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toMatchObject([{ file: 'sample.txt' }]);
        expect(() =>
            checkedFindings(check, { ...result, code: 78, stderr: 'Invalid native configuration.' }, [
                sandbox.path,
                sandbox.path,
            ]),
        ).toThrow(ToolOutputError);
        expect(() => checkedFindings(check, { ...result, stdout: '' }, [sandbox.path, sandbox.path])).toThrow(
            ToolOutputError,
        );
        expect(checkedFindings(check, { ...result, stdout: '', code: 0 }, [sandbox.path, sandbox.path])).toStrictEqual(
            [],
        );
    }
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
    expect(parseOutput(spec, corrected, '', sandbox.path)).toMatchObject([{ file: 'sample.txt', line: 1, column: 1 }]);
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
