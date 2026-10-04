import { join, win32 } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { checkedFindings } from '#cli/execution/output.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { EMPTY_FAILURE } from '#tests/config/cli/execution/output/shared.ts';

import {
    TYPO_REPORT,
    REPORT_ERRORS,
    MARKDOWN_REPORT,
    EDITORCONFIG_REPORT,
} from '#tests/config/cli/execution/parse-output/formats.ts';

test('invalid Markdown records remain execution errors and valid records parse', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
    const spec = configurationManifests()
        .get('markdown')!
        .checks.find(({ name }) => name === 'markdown/markdownlint')!;
    const valid = MARKDOWN_REPORT;
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
        expect(() => parseOutput(spec, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
    expect(parseOutput(spec, JSON.stringify([valid]), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.md', rule: 'MD033', fixable: false },
    ]);
});

test('invalid spelling output is an execution error and a valid record parses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.txt': `${TYPO.the}\n` });
    const spec = configurationManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const valid = TYPO_REPORT;
    for (const stdout of [
        '{',
        JSON.stringify({ type: 'typo', path: 'sample.txt', typo: TYPO.the }),
        JSON.stringify({ type: 'error', message: 'Read failed.' }),
        JSON.stringify({ ...valid, path: '../outside.txt' }),
        JSON.stringify({ ...valid, byte_offset: 99 }),
    ])
        expect(() => parseOutput(spec, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
    expect(parseOutput(spec, JSON.stringify(valid), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
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
        const findings = parseOutput(spec, '', output, { root: sandbox.path, cwd: sandbox.path });
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
        expect(
            checkedFindings(
                { spec, manifest: configurationManifests().get('bash')! },
                { ...EMPTY_FAILURE, stderr: output },
                { cwd: sandbox.path, root: sandbox.path },
            ),
        ).toStrictEqual(findings);
    }
});

test('XML diagnostics with carriage returns remain findings on real files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/feed.xml': '<feed><entry></feed>\n' });
    const spec = configurationManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/xmllint')!;
    const findings = parseOutput(spec, '', 'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n', {
        root: sandbox.path,
        cwd: sandbox.path,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/feed.xml', line: 1 });
    expect(
        checkedFindings(
            { spec, manifest: configurationManifests().get('files')! },
            { ...EMPTY_FAILURE, stderr: 'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual(findings);
});

test('Taplo reports one finding from a diff, a log entry, or both', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const spec = configurationManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo-format')!;
    const path = join(sandbox.path, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    for (const [stdout, stderr] of [
        [diff, 'INFO loaded configuration\n'],
        ['', log],
        [diff, log],
    ]) {
        const findings = parseOutput(spec, stdout!, stderr!, { root: sandbox.path, cwd: sandbox.path });
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
        expect(
            checkedFindings(
                { spec, manifest: configurationManifests().get('files')! },
                { ...EMPTY_FAILURE, stdout: stdout!, stderr: stderr! },
                { cwd: sandbox.path, root: sandbox.path },
            ),
        ).toStrictEqual(findings);
    }
});

test('a Taplo syntax error names its file by a Windows path with a drive letter', () => {
    const spec = configurationManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo')!;
    const stdout = 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n';
    expect(parseOutput(spec, stdout, '', { root: 'C:/work', cwd: 'C:/work' })).toMatchObject([
        { file: 'settings.toml', line: 2, column: 3 },
    ]);
});

test('grouped output strips line endings and relativizes native absolute paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const base = configurationManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo-format')!;
    const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(spec, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
});

test('EditorConfig retains file-level and line findings, including names beginning with a space', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.js': 'const greeting="hello";', ' notes.txt': 'text   \n' });
    const spec = configurationManifests()
        .get('format')!
        .checks.find(({ name }) => name === 'format/editorconfig-checker')!;
    for (const ending of ['\n', '\r\n']) {
        const output = EDITORCONFIG_REPORT.replaceAll('\n', ending);
        const findings = parseOutput(spec, output, '', { root: sandbox.path, cwd: sandbox.path });
        expect(
            findings.map(({ file, line, message: diagnostic }) => ({ file, line, message: diagnostic })),
        ).toStrictEqual([
            { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
            { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
        ]);
        expect(
            checkedFindings(
                { spec, manifest: configurationManifests().get('format')! },
                { ...EMPTY_FAILURE, stdout: output },
                { cwd: sandbox.path, root: sandbox.path },
            ),
        ).toStrictEqual(findings);
    }
});

// Windows tools can print the drive letter in another case; Linux file systems tell cases apart.
test.skipIf(process.platform === 'linux')(
    'an absolute path that names the root in another case is still relative to it',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'example/math.py': 'answer = 1\n' });
        const base = configurationManifests()
            .get('files')!
            .checks.find((check) => check.name === 'files/taplo-format')!;
        const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
        const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
        expect(parseOutput(spec, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
            { file: 'example/math.py', line: 1 },
        ]);
    },
);

test('a syntax diagnostic cannot promise an automatic fix when its check has no fixer', () => {
    const spec = configurationManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo')!;
    const findings = parseOutput(spec, '', '  ┌─ settings.toml:2:1\n', { root: '/repository', cwd: '/repository' });
    expect(findings).toMatchObject([
        { check: 'files/taplo', file: 'settings.toml', line: 2, column: 1, fixable: false },
    ]);
});

test('malformed ESLint output fails instead of becoming empty findings', () => {
    const spec = configurationManifests()
        .get('javascript')!
        .checks.find((check) => check.name === 'javascript/eslint')!;
    for (const text of [
        '',
        'not JSON',
        '[',
        '{}',
        '[{"filePath":"/repo/a.js","messages":null}]',
        '[{"filePath":"/repo/a.js","messages":[{"message":"partial"}]}]',
    ])
        expect(() => parseOutput(spec, text, '', { root: '/repo', cwd: '/repo' })).toThrow(GspotError);
    expect(parseOutput(spec, '[]', '', { root: '/repo', cwd: '/repo' })).toStrictEqual([]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    // Bun escapes a non-ASCII character inside String.raw, so the Windows path is normalized from slashes.
    [win32.normalize('C:/repo'), win32.normalize('C:/repo/café file.js'), 'café file.js'],
])('ESLint locations respect the root boundary %s for %s', (root, path, expected) => {
    const spec = configurationManifests()
        .get('javascript')!
        .checks.find((check) => check.name === 'javascript/eslint')!;
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(spec, stdout, '', { root: root, cwd: root })).toMatchObject([
        { file: expected, line: 1, column: 2 },
    ]);
});

test.each([...REPORT_ERRORS])(
    '$configuration distinguishes the report error: $message',
    async ({ configuration, stdout, message: diagnostic }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n', 'sample.txt': `${TYPO.the}\n` });
        const spec = configurationManifests()
            .get(configuration)!
            .checks.find(({ output }) => output?.format === (configuration === 'markdown' ? 'markdownlint' : 'typos'))!;
        expect(() => parseOutput(spec, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(diagnostic);
    },
);
