import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/platform/errors.ts';
import { checkedFindings } from '#cli/execution/command/findings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { EMPTY_FAILURE } from '#tests/config/cli/execution/command/findings.ts';
import { SEMGREP_MATCH, SEMGREP_PARSE_ERROR } from '#tests/config/cli/parsers/output/semgrep.ts';

test('Semgrep retains both rule and source parse diagnostics with positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const manifest = configurationManifests().get('security')!;
    const check = manifest.checks.find((check) => check.name === 'security/semgrep')!;
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [SEMGREP_PARSE_ERROR] });
    expect(
        checkedFindings(
            { check, manifest },
            { ...EMPTY_FAILURE, code: 3, stdout },
            { cwd: sandbox.path, root: sandbox.path },
        ),
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

test('Semgrep scanner, rule, unpositioned, and malformed reports remain execution errors', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\n' });
    const manifest = configurationManifests().get('security')!;
    const check = manifest.checks.find((check) => check.name === 'security/semgrep')!;
    const outputs = [
        '',
        '{}',
        'not JSON',
        JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, code: 2 }] }),
        JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, type: 'RuleParseError' }] }),
        JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, spans: [] }] }),
        JSON.stringify({ results: [{ ...SEMGREP_MATCH, start: { line: 0, col: 1 } }], errors: [] }),
    ];
    for (const stdout of outputs)
        expect(() =>
            checkedFindings(
                { check, manifest },
                { ...EMPTY_FAILURE, code: 3, stdout },
                { cwd: sandbox.path, root: sandbox.path },
            ),
        ).toThrow(GspotError);
    expect(
        checkedFindings(
            { check, manifest },
            { ...EMPTY_FAILURE, code: 0, stdout: '{"results":[],"errors":[]}' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual([]);
});
