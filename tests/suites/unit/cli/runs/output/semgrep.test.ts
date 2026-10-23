import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { SEMGREP_MATCH, SEMGREP_PARSE_ERROR, SEMGREP_REFUSED_REPORTS } from '#tests/config/runs/output/semgrep.ts';

test('Semgrep rule findings and source parse errors keep positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const configuration = readConfigurations().get('security')!;
    const check = configuration.checks.find((check) => check.id === 'security/semgrep')!;
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [SEMGREP_PARSE_ERROR] });
    expect(
        parseCommandFindings({ check }, buildProcessResult({ code: 3, stdout }), {
            cwd: sandbox.path,
            root: sandbox.path,
        }).findings,
    ).toStrictEqual([
        {
            check: 'security/semgrep',
            file: 'scripts/café build.sh',
            line: 2,
            column: 1,
            rule: 'gspot.bash.eval',
            message: 'eval runs a string as code.',
            help: check.help,
            fixable: false,
        },
        {
            check: 'security/semgrep',
            file: 'scripts/café build.sh',
            line: 1,
            column: 1,
            rule: 'parse-error',
            message: 'Syntax error in source.',
            help: check.help,
            fixable: false,
        },
    ]);
});
test.each([...SEMGREP_REFUSED_REPORTS])('a Semgrep report with %s is an error', async (_name, stdout, note) => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\n' });
    const check = readConfigurations()
        .get('security')!
        .checks.find((check) => check.id === 'security/semgrep')!;
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(parseCommandFindings({ check }, buildProcessResult({ code: 3, stdout }), paths).note).toBe(note);
    expect(
        parseCommandFindings({ check }, buildProcessResult({ stdout: '{"results":[],"errors":[]}' }), paths).findings,
    ).toStrictEqual([]);
});
