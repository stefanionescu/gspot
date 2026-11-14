import { testdir } from 'testdirs';
import { realpathSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, win32, resolve } from 'node:path';
import type { CheckStop } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { BASE_CHECK } from '#tests/config/engine/run.ts';
import { MISSING_RULE_HELP } from '#cli/config/engine.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isLinux } from '#tests/setup/system/platform.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

import {
    CHECK_OUTPUTS,
    LINE_ENDING_CASES,
    WINDOWS_ROOT_CASES,
    EDITORCONFIG_REPORT,
} from '#tests/config/engine/outputs.ts';

const ROOT = resolve('/repo');

test.each([...LINE_ENDING_CASES])(
    'ShellCheck output keeps path, position and rule with %s line endings',
    (_, ending) => {
        const check = getShippedCheck('bash/shellcheck');
        const path = join('scripts', 'café build.sh');

        const output = `${path}:1:6: note: Double quote to prevent globbing and word splitting. [SC2086]${ending}`;
        const findings = parseOutput(check, '', output, { root: ROOT, cwd: ROOT });
        expect(findings).toStrictEqual([
            {
                check: check.id,
                file: 'scripts/café build.sh',
                line: 1,
                column: 6,
                rule: 'SC2086',
                message: 'Double quote to prevent globbing and word splitting.',
                fixable: false,
            },
        ]);
    },
);

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', (source) => {
    const check = getShippedCheck('toml/taplo');
    const path = join(ROOT, 'settings', 'café.toml');
    const diff = `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a=1\n+a = 1\n`;
    const log = `ERROR taplo:format_files: the file is not properly formatted path="${path}"\n`;
    const stdout = source === 'log' ? '' : diff;
    const stderr = source === 'diff' ? 'INFO loaded configuration\n' : log;
    const findings = parseOutput(check, stdout, stderr, { root: ROOT, cwd: ROOT });
    expect(findings).toStrictEqual([
        {
            check: check.id,
            file: 'settings/café.toml',
            message: 'Not formatted the way Taplo formats it.',
            fixable: true,
        },
    ]);
});

test.each([...WINDOWS_ROOT_CASES])(
    'a Taplo syntax error in $root names its file and position and is not fixable',
    ({ root, stdout, stderr, line, column }) => {
        const check = getShippedCheck('toml/taplo');
        expect(parseOutput(check, stdout, stderr, { root, cwd: root })).toStrictEqual([
            {
                check: 'toml/taplo',
                file: 'settings.toml',
                line,
                column,
                message: 'The file does not parse as TOML.',
                fixable: false,
            },
        ]);
    },
);

test('EditorConfig output keeps file and line findings', () => {
    const check = getShippedCheck('format/editorconfig-checker');

    const findings = parseOutput(check, EDITORCONFIG_REPORT, '', { root: ROOT, cwd: ROOT });
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
});

test('an ESLint comment for a rule that no plugin holds gets the help that says to delete the comment', () => {
    const output = outputSchema.parse({
        format: 'json',
        fields: { file: 'file', message: 'message', rule: 'rule' },
    });
    const stdout = JSON.stringify([
        { file: '/repo/a.ts', rule: 'removed/rule', message: "Definition for rule 'removed/rule' was not found." },
    ]);
    const check = { runs: 'files' as const, id: 'javascript/eslint', output };
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([
        { help: MISSING_RULE_HELP },
    ]);
});

test('grouped output drops line endings and makes absolute paths relative', async () => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const check = { ...BASE_CHECK, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path, 'settings', 'café.toml')}:\r\n  1: Incorrect spacing\r\n`;
    const findings = parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings).toStrictEqual([
        {
            check: check.id,
            file: 'settings/café.toml',
            line: 1,
            message: 'Incorrect spacing',
            fixable: false,
        },
    ]);
    expect(
        parseOutput(check, './src/a.ts:\n  2: Incorrect spacing\n', '', { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([{ check: check.id, file: 'src/a.ts', line: 2, message: 'Incorrect spacing', fixable: false }]);
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

test.skipIf(isLinux)('an absolute path that names the root in another case is still relative to it', async () => {
    await using sandbox = await testdir({ 'example/math.py': 'answer = 1\n' });

    const check = { ...BASE_CHECK, output: outputSchema.parse({ format: 'grouped' }) };
    const output = `${join(sandbox.path.toUpperCase(), 'example', 'math.py')}:\n  1: Incorrect spacing\n`;
    expect(parseOutput(check, output, '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'example/math.py', line: 1 },
    ]);
});

const ESLINT_PATH_CASES: Array<[root: string, path: string, expected: string]> = [
    ['/repo', '/repository/a.js', '../repository/a.js'],
    [
        win32.normalize('C:/repo'),
        win32.normalize('C:/repo/café file.js'),
        process.platform === 'win32' ? 'café file.js' : win32.normalize('C:/repo/café file.js'),
    ],
];

test.each([...ESLINT_PATH_CASES])(
    'ESLint paths are relative to the root, inside it and outside it: %s, %s',
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

test('a finding in a check copy that names an installed package or a file outside holds no absolute path', async () => {
    await using sandbox = await testdir({
        'node_modules/vite/index.d.ts': '',
        'outside/types.d.ts': '',
        'repository/node_modules/vite/index.d.ts': '',
        'repository/.gspot-copies/1-copy/src/app.ts': '',
    });
    const output = outputSchema.parse({ format: 'regex', pattern: '^(?<file>(?:[A-Za-z]:)?[^:]+):(?<message>.+)$' });
    const check = { runs: 'files' as const, id: 'typescript/tsc', output };
    const repository = join(sandbox.path, 'repository');
    const root = join(repository, '.gspot-copies/1-copy');
    const installed = join(repository, 'node_modules/vite/index.d.ts');
    const stdout = [
        `${installed}:Cannot read ${repository}/package.json`,
        `${join(sandbox.path, 'outside/types.d.ts')}:Outside`,
    ].join('\n');
    expect(parseOutput(check, stdout, '', { root, cwd: root })).toMatchObject([
        { file: 'node_modules/vite/index.d.ts', message: 'Cannot read package.json' },
        { file: '../../../outside/types.d.ts', message: 'Outside' },
    ]);
});

test('a fixed regex message needs an explicit fixable pattern to offer a fix', () => {
    const output = outputSchema.parse({ format: 'regex', pattern: '^(?<file>.+)$', message: 'Needs attention.' });
    const check = { ...BASE_CHECK, output, fix: ['formatter'] };
    const paths = { root: '/repo', cwd: '/repo' };
    expect(parseOutput(check, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', fixable: false },
    ]);
    expect(parseOutput({ ...check, output: { ...output, fixable: '^source' } }, 'source.ts', '', paths)).toStrictEqual([
        { check: check.id, file: 'source.ts', message: 'Needs attention.', fixable: true },
    ]);
});

test.each(CHECK_OUTPUTS.flatMap(({ format, inputs }) => inputs.map((input) => ({ format, input }))))(
    'the $format format refuses $input output as an error of the check, and keeps the output out of the error',
    ({ format, input }) => {
        const check = { id: 'sandbox/output', runs: 'files' as const, output: { format } };
        const stdout = input === 'shape' ? '[{"unexpected":true}]' : 'not the output of any tool {\n';
        let stop: unknown;
        try {
            parseOutput(check, stdout, '', { root: ROOT, cwd: ROOT });
        } catch (error) {
            stop = error;
        }
        expect(stop).toMatchObject(matchFields<CheckStop>({ name: 'CheckStop', status: 'error' }));
        expect((stop as CheckStop).message).not.toContain(stdout.trim());
    },
);
