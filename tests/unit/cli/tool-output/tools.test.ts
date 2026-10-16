import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { FAILED_RUN } from '#tests/data/runs/command-checks.ts';
import { parseCommandFindings } from '#cli/checks/run/command/output.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';

import {
    TYPO_REPORT,
    REPORT_ERRORS,
    SEMGREP_MATCH,
    MARKDOWN_REPORT,
    SEMGREP_PARSE_ERROR,
    INVALID_KNIP_REPORTS,
} from '#tests/data/tool-output.ts';

test.each([...INVALID_KNIP_REPORTS])('an invalid Knip report is refused: %s', async (stdout) => {
    const check = readManifests(createReadCache(process.cwd()))
        .get('javascript')!
        .checks.find(({ name }) => name === 'javascript/knip')!;

    await using sandbox = await testdir();
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
});

test('a markdownlint record becomes a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        'markdown/markdownlint',
    )!.check;
    const valid = MARKDOWN_REPORT;
    expect(parseOutput(check, JSON.stringify([valid]), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.md', rule: 'MD033', fixable: false },
    ]);
});

test.each([...REPORT_ERRORS])('$configuration rejects $name: $message', async ({ configuration, output, message }) => {
    const stdout = typeof output === 'string' ? output : JSON.stringify(output);
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '<span>Content</span>\n',
        'sample.txt': `${TYPO.the}\n`,
    });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get(
        configuration === 'markdown' ? 'markdown/markdownlint' : 'spelling/typos',
    )!.check;
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(message);
});

test('Semgrep rule findings and source parse errors keep positions and Unicode paths', async () => {
    await using sandbox = await testdir({ 'scripts/café build.sh': 'if then\neval input\n' });
    const manifest = readManifests(createReadCache(process.cwd())).get('security')!;
    const check = manifest.checks.find((check) => check.name === 'security/semgrep')!;
    const stdout = JSON.stringify({ results: [SEMGREP_MATCH], errors: [SEMGREP_PARSE_ERROR] });
    expect(
        parseCommandFindings(
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
            parseCommandFindings(
                { check, manifest },
                { ...FAILED_RUN, code: 3, stdout },
                { cwd: sandbox.path, root: sandbox.path },
            ).note,
        ).toBeDefined();
    expect(
        parseCommandFindings(
            { check, manifest },
            { ...FAILED_RUN, code: 0, stdout: '{"results":[],"errors":[]}' },
            { cwd: sandbox.path, root: sandbox.path },
        ).findings,
    ).toStrictEqual([]);
});

test('a typos record becomes a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.txt': `${TYPO.the}\n` });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get('spelling/typos')!.check;
    const valid = TYPO_REPORT;
    expect(parseOutput(check, JSON.stringify(valid), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.txt', line: 1, column: 1 },
    ]);
});
