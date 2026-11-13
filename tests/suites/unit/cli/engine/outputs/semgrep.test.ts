import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseCommandFindings } from '#cli/engine/run/tool-runs/output.ts';
import { SEMGREP_MATCH, SEMGREP_PARSE_ERROR, SEMGREP_REFUSED_REPORTS } from '#tests/config/engine/outputs.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('Semgrep rule findings and source parse errors keep positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const check = getShippedCheck('security/semgrep');
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
            file: 'scripts/café build.sh',
            line: 2,
            column: 1,
            rule: 'gspot.bash.eval',
            message: 'eval runs a string as code.',
            fixable: false,
        },
        {
            check: 'security/semgrep',
            file: 'scripts/café build.sh',
            line: 1,
            column: 1,
            rule: 'parse-error',
            message: 'Syntax error in source.',
            fixable: false,
        },
    ]);
});

test('a nosemgrep comment that names another rule than the one that matched keeps the finding and is no scan error', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'eval input # nosemgrep: gspot.bash.other\n' });
    const check = getShippedCheck('security/semgrep');
    const warning = {
        code: 2,
        level: 'warn',
        type: 'SemgrepWarning',
        message: `SemgrepWarning at line ${SEMGREP_MATCH.path}:2:\n found 'nosem' comment with id 'gspot.bash.other', but no corresponding rule trying '${SEMGREP_MATCH.check_id}'`,
    };
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [warning] });
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const { findings } = parseCommandFindings({ check }, buildProcessResult({ code: 1, stdout }), paths, {});
    expect(findings?.map(({ rule }) => rule)).toStrictEqual([SEMGREP_MATCH.check_id]);
});

test.each([...SEMGREP_REFUSED_REPORTS])('a Semgrep report with %s is an error', async (_name, stdout) => {
    await using sandbox = await testdir({ 'scripts/café build.sh': BROKEN_IF_SCRIPT });
    const check = getShippedCheck('security/semgrep');
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const { note } = parseCommandFindings({ check }, buildProcessResult({ code: 3, stdout }), paths, {});
    expect(note).toContain(SEMGREP_PARSE_ERROR.message);
});
