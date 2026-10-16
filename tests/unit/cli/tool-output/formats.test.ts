import { test, expect } from 'bun:test';
import { join, win32 } from 'node:path';
import { isLinux } from '#tests/setup/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type CheckDeclaration } from '#cli/types/configurations.ts';
import { parseCommandFindings } from '#cli/checks/run/command/output.ts';
import { parseOutput, outputSchema } from '#cli/parsers/output/formats.ts';
import { BASE_CHECK, FAILED_RUN } from '#tests/data/runs/command-checks.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';

import {
    OUTPUTS,
    EMPTY_ERRORS,
    JSON_FORMATS,
    LINE_FINDINGS,
    OTHER_TOOL_OUTPUT,
    EDITORCONFIG_REPORT,
} from '#tests/data/tool-output.ts';

test.each(OUTPUTS.flatMap((output) => ['empty', 'foreign'].map((input) => ({ format: output.format, output, input }))))(
    'the $format format gives one result for $input output',
    async ({ output, input }) => {
        await using sandbox = await testdir();
        const check: CheckDeclaration = {
            ...BASE_CHECK,
            command: [...BASE_CHECK.command],
            name: 'sandbox/output',
            summary: 'Reads the output of a sandbox tool.',
            example: 'sandbox',
            why: 'The output contract holds for every format.',
            help: 'Correct the sandbox file.',
            output: outputSchema.parse(output),
        };
        delete check.command;
        const fails = (input === 'empty' ? EMPTY_ERRORS : JSON_FORMATS).has(output.format);
        if (fails) {
            expect(() =>
                parseOutput(check, input === 'empty' ? '' : OTHER_TOOL_OUTPUT, '', {
                    root: sandbox.path,
                    cwd: sandbox.path,
                }),
            ).toThrow(GspotError);
        } else {
            expect(
                parseOutput(check, input === 'empty' ? '' : OTHER_TOOL_OUTPUT, '', {
                    root: sandbox.path,
                    cwd: sandbox.path,
                }),
            ).toStrictEqual(input === 'foreign' && output.format === 'lines' ? [...LINE_FINDINGS] : []);
        }
    },
);

test.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
])('ShellCheck output keeps path, position and rule with %s line endings', async (_, ending) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/café build.sh': 'echo $1\n' });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get('bash/shellcheck')!.check;
    const path = join('scripts', 'café build.sh');

    const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
    const findings = parseOutput(check, '', output, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
    expect(
        parseCommandFindings(
            { check, manifest: readManifests(createReadCache(process.cwd())).get('bash')! },
            { ...FAILED_RUN, stderr: output },
            { cwd: sandbox.path, root: sandbox.path },
        ).findings,
    ).toStrictEqual(findings);
});

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'files/taplo-format',
    )!.check;
    const path = join(sandbox.path, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    const stdout = source === 'log' ? '' : diff;
    const stderr = source === 'diff' ? 'INFO loaded configuration\n' : log;
    const findings = parseOutput(check, stdout, stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
});

test('a Taplo syntax error names its file by a Windows path with a drive letter', () => {
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'files/taplo-format',
    )!.check;
    const stdout = 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n';
    expect(parseOutput(check, stdout, '', { root: 'C:/work', cwd: 'C:/work' })).toMatchObject([
        { file: 'settings.toml', line: 2, column: 3 },
    ]);
});

test('grouped output drops line endings and makes absolute paths relative', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'settings/café.toml': 'a=1\n' });
    const base = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'files/taplo-format',
    )!.check;
    const check: CheckDeclaration = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
});

test('EditorConfig output keeps file and line findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.js': 'const greeting="hello";', ' notes.txt': 'text   \n' });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'format/editorconfig-checker',
    )!.check;

    const output = EDITORCONFIG_REPORT;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, line, message }) => ({ file, line, message: message }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
});

// Windows and macOS file systems ignore case, so a tool can print the root in another case. Linux file systems do not.
test.skipIf(isLinux)('an absolute path that names the root in another case is still relative to it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'example/math.py': 'answer = 1\n' });
    const base = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'files/taplo-format',
    )!.check;
    const check: CheckDeclaration = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'example/math.py', line: 1 },
    ]);
});

test('a Taplo parse finding is not fixable', () => {
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'files/taplo-format',
    )!.check;
    const findings = parseOutput(check, '', '  ┌─ settings.toml:2:1\n', { root: '/repository', cwd: '/repository' });
    expect(findings).toMatchObject([
        { check: 'files/taplo-format', file: 'settings.toml', line: 2, column: 1, fixable: false },
    ]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    // Bun escapes Unicode inside String.raw; create the Windows path from slashes.
    [win32.normalize('C:/repo'), win32.normalize('C:/repo/café file.js'), 'café file.js'],
])('ESLint paths are relative to the root only inside it: %s, %s', (root, path, expected) => {
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'javascript/eslint',
    )!.check;
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(check, stdout, '', { root: root, cwd: root })).toMatchObject([
        { file: expected, line: 1, column: 2 },
    ]);
});
