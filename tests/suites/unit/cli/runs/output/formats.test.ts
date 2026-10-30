import { join } from 'node:path';
import { testdir } from 'testdirs';
import { realpathSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { getTool } from '#cli/manifests/tools.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { type Check } from '#cli/types/manifests.ts';
import { openSession } from '#cli/planning/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { CAFE_SCRIPT_PATH } from '#tests/config/paths.ts';
import { isLinux } from '#tests/setup/system/platform.ts';
import { FAILED_RUN } from '#tests/config/runs/samples.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { CommandRun } from '#cli/types/runs/command.ts';
import { GREETING_SOURCE } from '#tests/config/typescript.ts';
import { outputSchema } from '#cli/schemas/manifests/output.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { BASE_CHECK } from '#tests/config/runs/command/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { addCommandLine, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    CHECK_OUTPUTS,
    LINE_ENDING_CASES,
    ESLINT_PATH_CASES,
    WINDOWS_ROOT_CASES,
    EDITORCONFIG_REPORT,
    OUTPUT_PARSE_RESULTS,
    FIXABLE_FORMAT_CASES,
    BRACKETED_WORD_FINDINGS,
} from '#tests/config/runs/output/formats.ts';

function readParseResult(parse: () => Finding[]): { findings: readonly Finding[] } | { error: string } {
    try {
        return { findings: parse() };
    } catch (error) {
        return { error: (error as Error).message };
    }
}

test.each(
    CHECK_OUTPUTS.flatMap((output) =>
        (['empty', 'foreign'] as const).map((input) => ({ format: output.format, output, input })),
    ),
)(
    'the $format format reads $input output into its exact findings or its refusal',
    async ({ format, output, input }) => {
        await using sandbox = await testdir();
        const check = {
            id: 'sandbox/output',
            runs: 'files' as const,
            help: 'Correct the sandbox file.',
            output: outputSchema.parse(output),
        };
        const stdout = input === 'empty' ? '' : 'not the output of any tool {\n';
        expect(
            readParseResult(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })),
        ).toStrictEqual(OUTPUT_PARSE_RESULTS[format][input]);
    },
);

test.each([...LINE_ENDING_CASES])(
    'ShellCheck output keeps path, position and rule with %s line endings',
    async (_, ending) => {
        await using sandbox = await testdir({ 'scripts/café build.sh': 'echo $1\n' });

        const check = getShippedCheck('bash/shellcheck');
        const path = join('scripts', 'café build.sh');

        const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
        const findings = parseOutput(check, '', output, { root: sandbox.path, cwd: sandbox.path });
        expect(findings).toStrictEqual([
            {
                check: check.id,
                file: CAFE_SCRIPT_PATH,
                line: 1,
                column: 6,
                rule: 'SC2086',
                message: 'Double quote to prevent globbing and word splitting.',
                help: check.help,
                fixable: false,
            },
        ]);
        expect(
            parseCommandFindings({ check }, buildProcessResult({ ...FAILED_RUN, stderr: output }), {
                cwd: sandbox.path,
                root: sandbox.path,
            }).findings,
        ).toStrictEqual(findings);
    },
);

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', async (source) => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const check = getShippedCheck('data-files/taplo-format');
    const path = join(sandbox.path, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    const stdout = source === 'log' ? '' : diff;
    const stderr = source === 'diff' ? 'INFO loaded configuration\n' : log;
    const findings = parseOutput(check, stdout, stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toStrictEqual([
        {
            check: check.id,
            file: 'settings/café.toml',
            message: 'Not formatted the way Taplo formats it.',
            help: check.help,
            fixable: true,
        },
    ]);
});

test.each([...WINDOWS_ROOT_CASES])(
    'a Taplo syntax error in $root names its file and position and is not fixable',
    ({ root, stdout, stderr, line, column }) => {
        const check = getShippedCheck('data-files/taplo-format');
        expect(parseOutput(check, stdout, stderr, { root, cwd: root })).toStrictEqual([
            {
                check: 'data-files/taplo-format',
                file: 'settings.toml',
                line,
                column,
                message: 'The file does not parse as TOML.',
                help: check.help,
                fixable: false,
            },
        ]);
    },
);

test('grouped output drops line endings and makes absolute paths relative', async () => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const base = getShippedCheck('data-files/taplo-format');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toStrictEqual([
        {
            check: check.id,
            file: 'settings/café.toml',
            line: 1,
            message: 'Incorrect spacing',
            help: check.help,
            fixable: false,
        },
    ]);
    expect(
        parseOutput(check, './src/a.ts:\n  2: Incorrect spacing\n', '', { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([
        { check: check.id, file: 'src/a.ts', line: 2, message: 'Incorrect spacing', help: check.help, fixable: false },
    ]);
});

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
    await using sandbox = await testdir({ 'source.js': GREETING_SOURCE, ' notes.txt': 'text   \n' });

    const check = getShippedCheck('format/editorconfig-checker');

    const findings = parseOutput(check, EDITORCONFIG_REPORT, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
});

test.skipIf(isLinux)('an absolute path that names the root in another case is still relative to it', async () => {
    await using sandbox = await testdir({ 'example/math.py': 'answer = 1\n' });

    const base = getShippedCheck('data-files/taplo-format');
    const check: Check = { ...base, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'example/math.py', line: 1 },
    ]);
});

test.each([...ESLINT_PATH_CASES])(
    'ESLint paths are relative to the root only inside it: %s, %s',
    (root, path, expected) => {
        const check = getShippedCheck('javascript/eslint');
        const stdout = JSON.stringify([
            {
                filePath: path,
                messages: [{ ruleId: null, severity: 2, message: 'Invalid syntax.', line: 1, column: 2 }],
            },
        ]);
        expect(parseOutput(check, stdout, '', { root, cwd: root })).toMatchObject([
            { file: expected, line: 1, column: 2 },
        ]);
    },
);

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
    ).toStrictEqual([...BRACKETED_WORD_FINDINGS]);
    const pytest = getShippedCheck('pytest/coverage');
    expect(
        parseOutput(pytest, 'FAILED tests/test_total.py::test_sum - assert total(items) == expected(items)', '', paths),
    ).toStrictEqual([
        {
            check: 'pytest/coverage',
            file: 'tests/test_total.py',
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
    expect(parseOutput(check, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', help: check.help, fixable: false },
    ]);
    expect(parseOutput({ ...check, output: { ...output, fixable: '^source' } }, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', help: check.help, fixable: true },
    ]);
});

test.each([...FIXABLE_FORMAT_CASES])('the %s formatter declares which output supports fixing', (name, stdout, file) => {
    const check = getShippedCheck(name);
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([{ file, fixable: true }]);
});

test.each([false, true])(
    'an unexplained failed invocation fails the run with one finding (per file: %j)',
    async (perFile) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'source.js': 'export const ready = true;\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'commit', only: ['format/prettier'] })[0]!;
        const tool = getTool(readConfigurations().values(), 'prettier');
        const parsed: Finding[] = [];
        const state: CommandRun = { root: sandbox.path, cwd: sandbox.path, findings: [], failed: false };
        addCommandLine(
            planned,
            tool,
            {
                commandLine: { commandArguments: ['prettier'], ...(perFile && { file: 'source.js' }) },
                result: buildProcessResult({ code: 1, stdout: 'Format failed\n' }),
                findings: parsed,
            },
            state,
        );
        expect(state.failed).toBe(true);
        expect(state.findings).toMatchObject([
            { file: perFile ? 'source.js' : '', message: 'Format failed', fixable: false },
        ]);
    },
);
