import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { SEMGREP_MATCH, SEMGREP_PARSE_ERROR, SEMGREP_REFUSED_REPORTS } from '#tests/config/engine/outputs.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { CAFE_SCRIPT_PATH } from '#tests/config/setup/programs.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('Semgrep rule findings and source parse errors keep positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const configuration = readConfigurations().get('security')!;
    const check = configuration.checks.find((check) => check.id === 'security/semgrep')!;
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [SEMGREP_PARSE_ERROR] });
    expect(
        parseCommandFindings(
            { check },
            buildProcessResult({ code: 3, stdout }),
            {
                cwd: sandbox.path,
                root: sandbox.path,
            },
            {},
        ).findings,
    ).toStrictEqual([
        {
            check: 'security/semgrep',
            file: CAFE_SCRIPT_PATH,
            line: 2,
            column: 1,
            rule: 'gspot.bash.eval',
            message: 'eval runs a string as code.',
            help: check.help,
            fixable: false,
        },
        {
            check: 'security/semgrep',
            file: CAFE_SCRIPT_PATH,
            line: 1,
            column: 1,
            rule: 'parse-error',
            message: 'Syntax error in source.',
            help: check.help,
            fixable: false,
        },
    ]);
});

test.each([...SEMGREP_REFUSED_REPORTS])('a Semgrep report with %s is an error', async (_name, stdout) => {
    await using sandbox = await testdir({ 'scripts/café build.sh': BROKEN_IF_SCRIPT });
    const check = readConfigurations()
        .get('security')!
        .checks.find((check) => check.id === 'security/semgrep')!;
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const { note } = parseCommandFindings({ check }, buildProcessResult({ code: 3, stdout }), paths, {});
    expect(note).toContain(SEMGREP_PARSE_ERROR.message);
});
