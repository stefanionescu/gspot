import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import { EDITORCONFIG_REPORT, LINE_ENDING_CASES, WINDOWS_ROOT_CASES } from '#tests/config/engine/outputs.ts';
import { GREETING_SOURCE } from '#tests/config/setup/languages.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

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
                file: 'scripts/café build.sh',
                line: 1,
                column: 6,
                rule: 'SC2086',
                message: 'Double quote to prevent globbing and word splitting.',
                help: check.help,
                fixable: false,
            },
        ]);
    },
);

test.each(['diff', 'log', 'both'])('Taplo reports one finding from %s', async (source) => {
    await using sandbox = await testdir({ 'settings/café.toml': 'a=1\n' });

    const check = getShippedCheck('toml/taplo');
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
        const check = getShippedCheck('toml/taplo');
        expect(parseOutput(check, stdout, stderr, { root, cwd: root })).toStrictEqual([
            {
                check: 'toml/taplo',
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

test('EditorConfig output keeps file and line findings', async () => {
    await using sandbox = await testdir({ 'source.js': GREETING_SOURCE, ' notes.txt': 'text   \n' });

    const check = getShippedCheck('format/editorconfig-checker');

    const findings = parseOutput(check, EDITORCONFIG_REPORT, '', { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, line, message }) => ({ file, line, message }))).toStrictEqual([
        { file: 'source.js', line: undefined, message: 'Wrong line endings or no final newline' },
        { file: ' notes.txt', line: 1, message: 'Trailing whitespace' },
    ]);
});

test('an ESLint comment for a rule that no plugin holds says to delete the comment', () => {
    const output = outputSchema.parse({
        format: 'json',
        fields: { file: 'file', message: 'message', rule: 'rule' },
    });
    const stdout = JSON.stringify([
        { file: '/repo/a.ts', rule: 'removed/rule', message: "Definition for rule 'removed/rule' was not found." },
    ]);
    const check = { runs: 'files' as const, id: 'javascript/eslint', help: 'Fix it.', output };
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([
        { help: expect.stringContaining('Delete the comment.') as string },
    ]);
});
