import { join, win32 } from 'node:path';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import type { CheckSpec } from '#cli/types/kits.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { parseOutput } from '#cli/execution/tool/formats.ts';
import { isToolBroken } from '#cli/execution/tool/findings.ts';

test('invalid Markdown records remain execution errors and valid records parse', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
    const spec = kitManifests()
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
        expect(() => parseOutput(spec, stdout, '', sandbox.path)).toThrow(GspotError);
    expect(parseOutput(spec, JSON.stringify([valid]), '', sandbox.path)).toMatchObject([
        { file: 'sample.md', rule: 'MD033', fixable: false },
    ]);
});

test('invalid spelling output is an execution error and a valid record parses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.txt': `${TYPO.the}\n` });
    const spec = kitManifests()
        .get('spelling')!
        .checks.find((check) => check.name === 'spelling/typos')!;
    const valid = {
        type: 'typo',
        path: 'sample.txt',
        line_num: 1,
        byte_offset: 0,
        typo: TYPO.the,
        corrections: ['the'],
    };
    for (const stdout of [
        '{',
        JSON.stringify({ type: 'typo', path: 'sample.txt', typo: TYPO.the }),
        JSON.stringify({ type: 'error', message: 'Read failed.' }),
        JSON.stringify({ ...valid, path: '../outside.txt' }),
        JSON.stringify({ ...valid, byte_offset: 99 }),
    ])
        expect(() => parseOutput(spec, stdout, '', sandbox.path)).toThrow(GspotError);
    expect(parseOutput(spec, JSON.stringify(valid), '', sandbox.path)).toMatchObject([
        { file: 'sample.txt', line: 1, column: 1 },
    ]);
});

test('ShellCheck diagnostics retain their path, position, and rule with either line ending', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/café build.sh': 'echo $1\n' });
    const spec = kitManifests()
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
    const spec = kitManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/xmllint')!;
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
    const spec = kitManifests()
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
        const findings = parseOutput(spec, stdout!, stderr!, sandbox.path);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
        expect(isToolBroken(spec, findings, [sandbox.path])).toBe(false);
    }
});

test('a Taplo syntax error names its file by a Windows path with a drive letter', () => {
    const spec = kitManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo')!;
    const stdout = 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n';
    expect(parseOutput(spec, stdout, '', 'C:/work')).toMatchObject([{ file: 'settings.toml', line: 2, column: 3 }]);
});

test('grouped output strips line endings and relativizes native absolute paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const base = kitManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo-format')!;
    const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(spec, output, '', sandbox.path);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
});

// Windows tools can print the drive letter in another case; Linux file systems tell cases apart.
test.skipIf(process.platform === 'linux')(
    'an absolute path that names the root in another case is still relative to it',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'planted/math.py': 'answer = 1\n' });
        const base = kitManifests()
            .get('files')!
            .checks.find((check) => check.name === 'files/taplo-format')!;
        const spec: CheckSpec = { ...base, output: { format: 'grouped' } };
        const output = `${join(sandbox.path.toUpperCase(), 'planted', 'math.py')}:\n  1: Incorrect spacing\n`;
        expect(parseOutput(spec, output, '', sandbox.path)).toMatchObject([{ file: 'planted/math.py', line: 1 }]);
    },
);

test('a syntax diagnostic cannot promise an automatic fix when its check has no fixer', () => {
    const spec = kitManifests()
        .get('files')!
        .checks.find((check) => check.name === 'files/taplo')!;
    const findings = parseOutput(spec, '', '  ┌─ settings.toml:2:1\n', '/repository');
    expect(findings).toMatchObject([
        { check: 'files/taplo', file: 'settings.toml', line: 2, column: 1, fixable: false },
    ]);
});

test('malformed ESLint output fails instead of becoming empty findings', () => {
    const spec = kitManifests()
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
        expect(() => parseOutput(spec, text, '', '/repo')).toThrow(GspotError);
    expect(parseOutput(spec, '[]', '', '/repo')).toStrictEqual([]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    // Bun escapes a non-ASCII character inside String.raw, so the Windows path is normalized from slashes.
    [win32.normalize('C:/repo'), win32.normalize('C:/repo/café file.js'), 'café file.js'],
])('ESLint locations respect the root boundary %s for %s', (root, path, expected) => {
    const spec = kitManifests()
        .get('javascript')!
        .checks.find((check) => check.name === 'javascript/eslint')!;
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(spec, stdout, '', root)).toMatchObject([{ file: expected, line: 1, column: 2 }]);
});
