import { test, expect, describe } from 'bun:test';
import { stripVTControlCharacters } from 'node:util';
import { configureOutput } from '#cli/terminal/print.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runText, progress } from '#cli/terminal/check-report.ts';

import {
    REPORT,
    CHECK_REPORT_HOOKS,
    CHECK_REPORT_PROGRESS,
    CHECK_REPORT_STATUSES,
    CHECK_REPORT_COMPARISONS,
} from '#tests/config/terminal.ts';

describe('the check report', () => {
    test('skipped checks do not count as passed, and an empty canceled run is incomplete', () => {
        const skipped: RunReport = {
            ...REPORT,
            failed: [],
            exitCode: 0,
            checks: [
                {
                    check: 'example/skipped',
                    scope: '',
                    status: 'skipped',
                    fileCount: 0,
                    duration: 0,
                    findings: [],
                    note: 'disabled',
                },
            ],
        };
        expect(runText(skipped, false)).toEndWith(
            '0 checks passed, 0 checks failed, 1 check skipped, 0 findings, 0.0s\n',
        );
        expect(runText({ ...skipped, checks: [], exitCode: 2 }, false)).toEndWith('(incomplete)\n');
        const corrected: RunReport = { ...skipped, checks: [{ ...skipped.checks[0]!, status: 'passed' }] };
        const text = runText(corrected, false);
        expect(text).toEndWith('1 check passed, 0 checks failed, 0 checks skipped, 0 findings, 0.0s\n');
    });
    test('one line per check, the findings with a help line, the reproduce lines and the summary', () => {
        const text = runText(REPORT, false);
        expect(text).toContain('root  bash/shellcheck  failed     3 files     0.1s');
        expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
        expect(text).toContain('    help: Quote it.');
        expect(text).toContain('  reproduce: gspot check --only bash/shellcheck');
        expect(text).toContain('api   format/prettier  missing    prettier is not installed. Run: mise install');
        expect(text).toContain('ignores    1 (printed with --verbose)');
        expect(text).toEndWith('1 check passed, 2 checks failed, 0 checks skipped, 1 finding, 0.0s (failed)\n');
    });

    test('--verbose prints ignores with their reasons', () => {
        expect(runText(REPORT, false)).toContain('bash/shfmt');
        expect(runText(REPORT, true)).toContain('ignore     bash/shellcheck SC2312  why  (1 matched)');
    });
});

test('findings that share a help print it once, after the last of them', () => {
    const [shellcheck] = REPORT.checks;
    const [finding] = shellcheck.findings;
    const shared: RunReport = {
        ...REPORT,
        checks: [
            {
                ...shellcheck,
                findings: [finding, { ...finding, line: 9 }, { ...finding, line: 12, help: 'Quote the path.' }],
            },
        ],
    };
    const lines = stripVTControlCharacters(runText(shared, false)).split('\n');
    expect(lines.filter((line) => line === '    help: Quote it.')).toHaveLength(1);
    expect(lines.indexOf('    help: Quote it.')).toBe(
        lines.indexOf('  a.sh:9:3  SC2086  Double quote to prevent globbing.') + 1,
    );
    expect(lines).toContain('    help: Quote the path.');
});

test('colors change the report only by escape codes', () => {
    configureOutput({ json: false, color: false });
    const plain = runText(REPORT, false);
    try {
        configureOutput({ json: false, color: true });
        const colored = runText(REPORT, false);
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
    } finally {
        configureOutput({ json: false, color: false });
    }
    expect(runText(REPORT, false)).toBe(plain);
});

test.each([...CHECK_REPORT_COMPARISONS])('the report names $content comparisons', ({ content, header }) => {
    const compared: RunReport = { ...REPORT, comparison: { content, reference: 'main' } };
    expect(runText(compared, false)).toBe(header + runText(REPORT, false));
});

test('the report names the cause of a skipped check', () => {
    const skipped: RunReport = { ...REPORT, skips: [{ check: 'bash/shellcheck', cause: 'condition' }] };
    expect(runText(skipped, false)).toContain('skipped    bash/shellcheck  (condition)\n');
});

test.each([...CHECK_REPORT_HOOKS])(
    'a failed $hook report prints each reproduce line once and the hook bypass',
    ({ hook, command }) => {
        const text = runText(REPORT, false, hook);
        expect(text).toEndWith(`Bypass this hook once: git ${command} --no-verify\n`);
        expect(text.split('reproduce: gspot check --only bash/shellcheck')).toHaveLength(2);
        expect(runText({ ...REPORT, checks: [] }, false, hook)).toEndWith(
            `Bypass this hook once: git ${command} --no-verify\n`,
        );
        expect(runText({ ...REPORT, exitCode: 0 }, false, hook)).not.toContain('Bypass this hook');
    },
);

test('terminal progress prints passed and skipped checks, and log output only failures', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    const stderr = process.stderr;
    const write = Object.getOwnPropertyDescriptor(stderr, 'write');
    const tty = Object.getOwnPropertyDescriptor(stderr, 'isTTY');
    try {
        for (const [isTTY, lines] of [
            [true, terminal],
            [false, log],
        ] as const) {
            Object.defineProperty(stderr, 'isTTY', { value: isTTY, configurable: true });
            stderr.write = (chunk) => {
                lines.push(String(chunk));
                return true;
            };
            for (const status of CHECK_REPORT_STATUSES) progress({ ...CHECK_REPORT_PROGRESS, status });
        }
    } finally {
        if (write === undefined) Reflect.deleteProperty(stderr, 'write');
        else Object.defineProperty(stderr, 'write', write);
        if (tty === undefined) Reflect.deleteProperty(stderr, 'isTTY');
        else Object.defineProperty(stderr, 'isTTY', tty);
    }
    expect(terminal).toStrictEqual([
        'app  example/check  passed\n',
        'app  example/check  skipped\n',
        'app  example/check  failed\n',
        'app  example/check  missing\n',
        'app  example/check  error\n',
    ]);
    expect(log).toStrictEqual([
        'app  example/check  failed\n',
        'app  example/check  missing\n',
        'app  example/check  error\n',
    ]);
});
