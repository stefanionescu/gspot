import { stripVTControlCharacters } from 'node:util';
import { configureOutput } from '#cli/output/messages.ts';
import { main } from '#cli/program.ts';
import type { RunReport } from '#cli/output/report-types.ts';
import { describe, expect, test } from 'bun:test';
import { runText } from '#cli/output/reporter.ts';

const report: RunReport = {
    version: '0.1.0',
    stage: 'all',
    started: '2026-09-18T00:00:00.000Z',
    duration: 10,
    checks: [
        {
            check: 'bash/shellcheck',
            scope: '',
            status: 'fail',
            files: 3,
            duration: 120,
            reproduce: 'gspot check --only bash/shellcheck',
            findings: [
                {
                    check: 'bash/shellcheck',
                    file: 'a.sh',
                    line: 4,
                    column: 3,
                    rule: 'SC2086',
                    message: 'Double quote to prevent globbing.',
                    help: 'Quote it.',
                    fixable: false,
                },
            ],
        },
        { check: 'bash/shfmt', scope: '', status: 'ok', files: 3, duration: 20, findings: [] },
        {
            check: 'formatting/prettier',
            scope: 'api',
            status: 'missing',
            files: 1,
            duration: 0,
            findings: [],
            note: 'prettier is not installed. Run: mise install',
            reproduce: 'gspot check api --only formatting/prettier',
        },
    ],
    ignores: [{ check: 'bash/shellcheck', rule: 'SC2312', reason: 'why', matched: 1 }],
    skips: [],
    coverage: { checked: 3, unchecked: 2, findings: [] },
    suppressions: {},
    unstaged: 0,
    narrowed: false,
    failed: ['bash/shellcheck', 'formatting/prettier'],
    exitCode: 1,
};

describe('the reporter', () => {
    test('skipped checks do not count as passes and an empty canceled run is incomplete', () => {
        const skipped: RunReport = {
            ...report,
            failed: [],
            exitCode: 0,
            checks: [
                {
                    check: 'example/skipped',
                    scope: '',
                    status: 'skipped',
                    files: 0,
                    duration: 0,
                    findings: [],
                    note: 'disabled',
                },
            ],
        };
        expect(runText(skipped, { quiet: true, verbose: false })).toEndWith(
            '0 checks passed, 0 checks failed, 1 check skipped, 0 findings, 0.0s\n',
        );
        expect(runText({ ...skipped, checks: [], exitCode: 2 }, { quiet: true, verbose: false })).toEndWith(
            '(incomplete)\n',
        );
        const corrected: RunReport = { ...skipped, checks: [{ ...skipped.checks[0]!, status: 'cache' }] };
        const text = runText(corrected, { quiet: false, verbose: false });
        expect(text).toEndWith('1 check passed, 0 checks failed, 0 checks skipped, 0 findings, 0.0s\n');
    });
    test('prints one line per check, findings file first with a help line, reproduce lines and the summary', () => {
        const text = runText(report, { quiet: false, verbose: false });
        expect(text).toContain('root  bash/shellcheck      fail       3 files     0.1s');
        expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
        expect(text).toContain('    help: Quote it.');
        expect(text).toContain('  reproduce: gspot check --only bash/shellcheck');
        expect(text).toContain('api   formatting/prettier  missing    prettier is not installed. Run: mise install');
        expect(text).toContain('ignores    1 (printed with --verbose)');
        expect(text).toContain('unchecked  2 files (gspot doctor)');
        expect(text).toEndWith('1 check passed, 2 checks failed, 0 checks skipped, 1 finding, 0.0s (failed)\n');
    });

    test('--quiet hides passing checks and --verbose prints ignores with reasons', () => {
        expect(runText(report, { quiet: true, verbose: false })).not.toContain('bash/shfmt');
        expect(runText(report, { quiet: false, verbose: true })).toContain(
            'ignore     bash/shellcheck SC2312  why  (1 matched)',
        );
    });
});

describe('the program', () => {
    test('an unknown command exits 2', async () => {
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;
        try {
            expect(await main(['xyzzy'])).toBe(2);
        } finally {
            process.stderr.write = original;
        }
    });
});

test('report colors follow the configured output mode without changing its text', () => {
    configureOutput({ verbosity: 'normal', json: false, color: false });
    const plain = runText(report, { quiet: false, verbose: false });
    try {
        configureOutput({ verbosity: 'normal', json: false, color: true });
        const colored = runText(report, { quiet: false, verbose: false });
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
    } finally {
        configureOutput({ verbosity: 'normal', json: false, color: false });
    }
    expect(runText(report, { quiet: false, verbose: false })).toBe(plain);
});
