import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { FAILED_RUN } from '#tests/config/execution.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { commandOutcome } from '#cli/checks/run/command/output.ts';
import { SEMGREP_MATCH, SEMGREP_PARSE_ERROR } from '#tests/config/semgrep.ts';

test('Semgrep rule findings and source parse errors keep positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const manifest = readManifests(createReadCache(process.cwd())).get('security')!;
    const check = manifest.checks.find((check) => check.name === 'security/semgrep')!;
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [SEMGREP_PARSE_ERROR] });
    expect(
        commandOutcome(
            { check, manifest },
            { ...FAILED_RUN, code: 3, stdout },
            { cwd: sandbox.path, root: sandbox.path },
        ).findings,
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

test('Semgrep scanner, rule, unpositioned and malformed reports are errors', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\n' });
    const manifest = readManifests(createReadCache(process.cwd())).get('security')!;
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
        expect(
            commandOutcome(
                { check, manifest },
                { ...FAILED_RUN, code: 3, stdout },
                { cwd: sandbox.path, root: sandbox.path },
            ).note,
        ).toBeDefined();
    expect(
        commandOutcome(
            { check, manifest },
            { ...FAILED_RUN, code: 0, stdout: '{"results":[],"errors":[]}' },
            { cwd: sandbox.path, root: sandbox.path },
        ).findings,
    ).toStrictEqual([]);
});
