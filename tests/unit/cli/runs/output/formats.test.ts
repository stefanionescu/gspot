import { testdir } from 'testdirs';
import { realpathSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, win32 } from 'node:path';
import { openSession } from '#cli/session.ts';
import { isLinux } from '#tests/setup/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { planChecks } from '#cli/planning/checks.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { type Check } from '#cli/types/configurations.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { CommandRunState } from '#cli/types/runs/command.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { BASE_CHECK, FAILED_RUN } from '#tests/data/runs/command-checks.ts';
import { getShippedCheck, buildProcessResult } from '#tests/setup/builders.ts';
import { addCommandLine, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    EMPTY_ERRORS,
    JSON_FORMATS,
    CHECK_OUTPUTS,
    LINE_FINDINGS,
    OTHER_TOOL_OUTPUT,
    EDITORCONFIG_REPORT,
} from '#tests/data/runs/output.ts';

test.each(
    CHECK_OUTPUTS.flatMap((output) => ['empty', 'foreign'].map((input) => ({ format: output.format, output, input }))),
)('the $format format gives one result for $input output', async ({ output, input }) => {
    await using sandbox = await testdir();
    const check = {
        name: 'sandbox/output',
        runs: 'files' as const,
        help: 'Correct the sandbox file.',
        output: outputSchema.parse(output),
    };
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
});

test.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
])('ShellCheck output keeps path, position and rule with %s line endings', async (_, ending) => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'echo $1\n' });

    const check = getShippedCheck('bash/shellcheck');
    const path = join('scripts', 'café build.sh');

    const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
    const findings = parseOutput(check, '', output, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'scripts/café build.sh', line: 1, column: 6, rule: 'SC2086' });
    expect(
        parseCommandFindings({ check }, buildProcessResult({ ...FAILED_RUN, stderr: output }), {
            cwd: sandbox.path,
            root: sandbox.path,
        }).findings,
    ).toStrictEqual(findings);
});

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', async (source) => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const check = getShippedCheck('files/taplo-format');
    const path = join(sandbox.path, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    const stdout = source === 'log' ? '' : diff;
    const stderr = source === 'diff' ? 'INFO loaded configuration\n' : log;
    const findings = parseOutput(check, stdout, stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', fixable: true });
});

test.each([
    {
        root: 'C:/work',
        stdout: 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n',
        stderr: '',
        line: 2,
        column: 3,
    },
    { root: '/repository', stdout: '', stderr: '  ┌─ settings.toml:2:1\n', line: 2, column: 1 },
])(
    'a Taplo syntax error in $root names its file and position and is not fixable',
    ({ root, stdout, stderr, line, column }) => {
        const check = getShippedCheck('files/taplo-format');
        expect(parseOutput(check, stdout, stderr, { root, cwd: root })).toMatchObject([
            { check: 'files/taplo-format', file: 'settings.toml', line, column, fixable: false },
        ]);
    },
);

test('grouped output drops line endings and makes absolute paths relative', async () => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const base = getShippedCheck('files/taplo-format');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'settings/café.toml', line: 1, message: 'Incorrect spacing' });
});

// Docker Compose prints the resolved path, such as /private/var on macOS for a root under /var.
test('a message that names a file by its resolved absolute path names it relative to the root', async () => {
    await using sandbox = await testdir();
    const check = getShippedCheck('docker/compose');
    const file = `${convertToPosixPath(realpathSync.native(sandbox.path))}/api/compose.yml`;
    const output = `validating ${file}: services.api.bogus false schema\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { message: 'validating api/compose.yml: services.api.bogus false schema' },
    ]);
});

test('EditorConfig output keeps file and line findings', async () => {
    await using sandbox = await testdir({ 'source.js': 'const greeting="hello";', ' notes.txt': 'text   \n' });

    const check = getShippedCheck('format/editorconfig-checker');

    const findings = parseOutput(check, EDITORCONFIG_REPORT, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
});

// Windows and macOS file systems ignore case, so a tool can print the root in another case. Linux file systems do not.
test.skipIf(isLinux)('an absolute path that names the root in another case is still relative to it', async () => {
    await using sandbox = await testdir({ 'example/math.py': 'answer = 1\n' });

    const base = getShippedCheck('files/taplo-format');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'example/math.py', line: 1 },
    ]);
});

test.each([
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    // Bun escapes Unicode inside String.raw; create the Windows path from slashes.
    [
        win32.normalize('C:/repo'),
        win32.normalize('C:/repo/café file.js'),
        process.platform === 'win32' ? 'café file.js' : win32.normalize('C:/repo/café file.js'),
    ],
])('ESLint paths are relative to the root only inside it: %s, %s', (root, path, expected) => {
    const check = getShippedCheck('javascript/eslint');
    const stdout = JSON.stringify([
        { filePath: path, messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }] },
    ]);
    expect(parseOutput(check, stdout, '', { root: root, cwd: root })).toMatchObject([
        { file: expected, line: 1, column: 2 },
    ]);
});

test('a regex finding without a rule group keeps a trailing bracketed word in its message', () => {
    const check = { ...BASE_CHECK, output: outputSchema.parse({ format: 'regex' }) };
    const paths = { root: '/repository', cwd: '/repository' };
    expect(
        parseOutput(
            check,
            'a.txt:1: Call the function by its full name (fetch)\nb.txt:2: Name the type [User]\n',
            '',
            paths,
        ),
    ).toStrictEqual([
        {
            check: 'sandbox/diagnostic',
            file: 'a.txt',
            line: 1,
            message: 'Call the function by its full name (fetch)',
            help: '',
            fixable: false,
        },
        {
            check: 'sandbox/diagnostic',
            file: 'b.txt',
            line: 2,
            message: 'Name the type [User]',
            help: '',
            fixable: false,
        },
    ]);
    const pytest = getShippedCheck('pytest/coverage');
    expect(
        parseOutput(pytest, 'FAILED tests/test_total.py::test_sum - assert total(items) == expected(items)', '', paths),
    ).toStrictEqual([
        {
            check: 'pytest/coverage',
            file: '',
            message: 'FAILED tests/test_total.py::test_sum - assert total(items) == expected(items)',
            help: pytest.help,
            fixable: false,
        },
    ]);
});

test('a fixed regex message needs an explicit fixable pattern to offer a fix', () => {
    const output = outputSchema.parse({ format: 'regex', pattern: '^(?<file>.+)$', message: 'Needs attention.' });
    const check = { ...BASE_CHECK, output, fix: ['formatter'] };
    const paths = { root: '/repo', cwd: '/repo' };
    expect(parseOutput(check, 'source.ts', '', paths)).toMatchObject([{ message: 'Needs attention.', fixable: false }]);
    expect(parseOutput({ ...check, output: { ...output, fixable: '^source' } }, 'source.ts', '', paths)).toMatchObject([
        { fixable: true },
    ]);
});

test('an unsuccessful SARIF invocation becomes a refused-output note for its command', () => {
    const check = { ...BASE_CHECK, command: [...BASE_CHECK.command], output: outputSchema.parse({ format: 'sarif' }) };
    const stdout = JSON.stringify({
        version: '2.1.0',
        runs: [{ results: [], invocations: [{ executionSuccessful: false }] }],
    });
    expect(
        parseCommandFindings({ check }, buildProcessResult({ stdout }), { root: '/repo', cwd: '/repo' }),
    ).toStrictEqual({
        note: 'SARIF reported an unsuccessful analysis.',
    });
});

test.each([
    ['format/prettier', '[warn] source.ts', 'source.ts'],
    ['python/ruff-format', 'source.py:1:1: unformatted: different spacing', 'source.py'],
])('the %s formatter declares which output supports fixing', (name, stdout, file) => {
    const check = getShippedCheck(name);
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([{ file, fixable: true }]);
});

test.each([false, true])(
    'an unexplained failed invocation shares its fresh finding with the run (per file: %j)',
    async (perFile) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'source.js': 'export const ready = true;\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'commit', only: ['format/prettier'] })[0]!;
        const tool = getTool(readConfigurations().values(), 'prettier');
        const parsed: Finding[] = [];
        const state: CommandRunState = { root: sandbox.path, cwd: sandbox.path, findings: [], failed: false };
        addCommandLine(
            planned,
            tool,
            {
                commandLine: { commandArguments: ['prettier'], ...(perFile ? { file: 'source.js' } : {}) },
                result: buildProcessResult({ code: 1, stdout: 'Format failed\n' }),
                findings: parsed,
            },
            state,
        );
        expect(state.failed).toBe(true);
        expect(parsed).toHaveLength(1);
        expect(state.findings).toStrictEqual(parsed);
        expect(state.findings[0]).toMatchObject({
            file: perFile ? 'source.js' : '',
            message: 'Format failed',
            fixable: false,
        });
    },
);
