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
    coverage: { checked: 3, unchecked: 2 },
    suppressions: {},
    unstaged: 0,
    narrowed: false,
    failed: ['bash/shellcheck', 'formatting/prettier'],
    exitCode: 1,
};

describe('the reporter', () => {
    test('prints one line per check, findings file first with a help line, reproduce lines and the summary', () => {
        const text = runText(report, { quiet: false, verbose: false });
        expect(text).toContain('root  bash/shellcheck      fail       3 files     0.1s');
        expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
        expect(text).toContain('    help: Quote it.');
        expect(text).toContain('  reproduce: gspot check --only bash/shellcheck');
        expect(text).toContain('api   formatting/prettier  missing    prettier is not installed. Run: mise install');
        expect(text).toContain('ignores    1 (printed with --verbose)');
        expect(text).toContain('unchecked  2 files (gspot doctor)');
        expect(text).toEndWith('failed: bash/shellcheck, formatting/prettier\n');
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
