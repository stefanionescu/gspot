import { join, win32 } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/public.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { parseOutput } from '#cli/parsers/output/public.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { checkedFindings } from '#cli/execution/command/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { EMPTY_FAILURE } from '#tests/config/cli/execution/command/findings.ts';

import {
    TYPO_REPORT,
    REPORT_ERRORS,
    MARKDOWN_REPORT,
    EDITORCONFIG_REPORT,
} from '#tests/config/cli/parsers/output/formats.ts';

test('valid Markdown records parse', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
    const check = configurationCheck('markdown', 'markdown/markdownlint');
    const valid = MARKDOWN_REPORT;
    expect(parseOutput(check, JSON.stringify([valid]), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.md', rule: 'MD033', fixable: false },
    ]);
});

test('a valid spelling record parses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.txt': `${TYPO.the}\n` });
    const check = configurationCheck('spelling', 'spelling/typos');
    const valid = TYPO_REPORT;
    expect(parseOutput(check, JSON.stringify(valid), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.txt', line: 1, column: 1 },
    ]);
});

test.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
])('ShellCheck retains its path, position, and rule with %s', async (_, ending) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/café build.sh': 'echo $1\n' });
    const check = configurationCheck('bash', 'bash/shellcheck');
    const path = join('scripts', 'café build.sh');

    const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
    const findings = parseOutput(check, '', output, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
    expect(
        checkedFindings(
            { check, manifest: configurationManifests().get('bash')! },
            { ...EMPTY_FAILURE, stderr: output },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual(findings);
});

test('XML diagnostics with carriage returns remain findings on real files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/feed.xml': '<feed><entry></feed>\n' });
    const check = configurationCheck('files', 'files/xmllint');
    const findings = parseOutput(check, '', 'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n', {
        root: sandbox.path,
        cwd: sandbox.path,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/feed.xml', line: 1 });
    expect(
        checkedFindings(
            { check, manifest: configurationManifests().get('files')! },
            { ...EMPTY_FAILURE, stderr: 'settings/feed.xml:1: parser error : Opening and ending tag mismatch\r\n' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual(findings);
});

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const check = configurationCheck('files', 'files/taplo-format');
    const path = join(sandbox.path, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    const stdout = source === 'log' ? '' : diff;
    const stderr = source === 'diff' ? 'INFO loaded configuration\n' : log;
    const findings = parseOutput(check, stdout, stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
    expect(
        checkedFindings(
            { check, manifest: configurationManifests().get('files')! },
            { ...EMPTY_FAILURE, stdout, stderr },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual(findings);
});

test('a Taplo syntax error names its file by a Windows path with a drive letter', () => {
    const check = configurationCheck('files', 'files/taplo');
    const stdout = 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n';
    expect(parseOutput(check, stdout, '', { root: 'C:/work', cwd: 'C:/work' })).toMatchObject([
        { file: 'settings.toml', line: 2, column: 3 },
    ]);
});

test('grouped output strips line endings and relativizes native absolute paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const base = configurationCheck('files', 'files/taplo-format');
    const check: CheckDeclaration = { ...base, output: { format: 'grouped' } };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
});

test.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
])('EditorConfig retains file-level and line findings with %s', async (_, ending) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.js': 'const greeting="hello";', ' notes.txt': 'text   \n' });
    const check = configurationCheck('format', 'format/editorconfig-checker');

    const output = EDITORCONFIG_REPORT.replaceAll('\n', ending);
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, line, message: diagnostic }) => ({ file, line, message: diagnostic }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
    expect(
        checkedFindings(
            { check, manifest: configurationManifests().get('format')! },
            { ...EMPTY_FAILURE, stdout: output },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual(findings);
});

// Windows tools can print the drive letter in another case; Linux file systems tell cases apart.
test.skipIf(process.platform === 'linux')(
    'an absolute path that names the root in another case is still relative to it',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'example/math.py': 'answer = 1\n' });
        const base = configurationCheck('files', 'files/taplo-format');
        const check: CheckDeclaration = { ...base, output: { format: 'grouped' } };
        const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
        expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
            { file: 'example/math.py', line: 1 },
        ]);
    },
);

test('a syntax diagnostic cannot promise an automatic fix when its check has no fixer', () => {
    const check = configurationCheck('files', 'files/taplo');
    const findings = parseOutput(check, '', '  ┌─ settings.toml:2:1\n', { root: '/repository', cwd: '/repository' });
    expect(findings).toMatchObject([
        { check: 'files/taplo', file: 'settings.toml', line: 2, column: 1, fixable: false },
    ]);
});

test.each([
    ['empty report', ''],
    ['non-JSON text', 'not JSON'],
    ['unfinished array', '['],
    ['non-array report', '{}'],
    ['null messages', '[{"filePath":"/repo/a.js","messages":null}]'],
    ['missing mapped message', '[{"filePath":"/repo/a.js","messages":[{"severity":2}]}]'],
])('malformed ESLint output fails for %s', (_, text) => {
    const check = configurationCheck('javascript', 'javascript/eslint');
    expect(() => parseOutput(check, text, '', { root: '/repo', cwd: '/repo' })).toThrow(GspotError);
});

test('an empty ESLint report has no findings', () => {
    const check = configurationCheck('javascript', 'javascript/eslint');
    expect(parseOutput(check, '[]', '', { root: '/repo', cwd: '/repo' })).toStrictEqual([]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    // Bun escapes a non-ASCII character inside String.raw, so the Windows path is normalized from slashes.
    [win32.normalize('C:/repo'), win32.normalize('C:/repo/café file.js'), 'café file.js'],
])('ESLint locations respect the root boundary %s for %s', (root, path, expected) => {
    const check = configurationCheck('javascript', 'javascript/eslint');
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(check, stdout, '', { root: root, cwd: root })).toMatchObject([
        { file: expected, line: 1, column: 2 },
    ]);
});

test.each([...REPORT_ERRORS])(
    '$configuration rejects $name: $message',
    async ({ configuration, output, message: diagnostic }) => {
        const stdout = typeof output === 'string' ? output : JSON.stringify(output);
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n', 'sample.txt': `${TYPO.the}\n` });
        const check = configurationCheck(
            configuration,
            configuration === 'markdown' ? 'markdown/markdownlint' : 'spelling/typos',
        );
        expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(diagnostic);
    },
);

function configurationCheck(configuration: string, name: string): CheckDeclaration {
    return configurationManifests()
        .get(configuration)!
        .checks.find((check) => check.name === name)!;
}
