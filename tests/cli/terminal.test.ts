import { test, expect, describe } from 'bun:test';
import { stripVTControlCharacters } from 'node:util';
import { REPORT } from '#tests/config/cli/terminal.ts';
import { configureOutput } from '#cli/terminal/messages.ts';
import { runText, progress } from '#cli/terminal/reporter.ts';
import type { ComparisonCase } from '#tests/types/cli/terminal.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/check.ts';

describe('the reporter', () => {
    test('skipped checks do not count as passes and an empty canceled run is incomplete', () => {
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
        expect(runText(skipped, 'quiet')).toEndWith(
            '0 checks passed, 0 checks failed, 1 check skipped, 0 findings, 0.0s\n',
        );
        expect(runText({ ...skipped, checks: [], exitCode: 2 }, 'quiet')).toEndWith('(incomplete)\n');
        const corrected: RunReport = { ...skipped, checks: [{ ...skipped.checks[0]!, status: 'passed' }] };
        const text = runText(corrected, 'normal');
        expect(text).toEndWith('1 check passed, 0 checks failed, 0 checks skipped, 0 findings, 0.0s\n');
    });
    test('prints one line per check, findings file first with a help line, reproduce lines and the summary', () => {
        const text = runText(REPORT, 'normal');
        expect(text).toContain('root  bash/shellcheck  failed     3 files     0.1s');
        expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
        expect(text).toContain('    help: Quote it.');
        expect(text).toContain('  reproduce: gspot check --only bash/shellcheck');
        expect(text).toContain('api   format/prettier  missing    prettier is not installed. Run: mise install');
        expect(text).toContain('ignores    1 (printed with --verbose)');
        expect(text).toEndWith('1 check passed, 2 checks failed, 0 checks skipped, 1 finding, 0.0s (failed)\n');
    });

    test('--quiet hides passing checks and --verbose prints ignores with reasons', () => {
        expect(runText(REPORT, 'quiet')).not.toContain('bash/shfmt');
        expect(runText(REPORT, 'normal')).toContain('bash/shfmt');
        expect(runText(REPORT, 'verbose')).toContain('ignore     bash/shellcheck SC2312  why  (1 matched)');
    });
});

test('findings that share a help print it once, after the last of them', () => {
    const [shellcheck] = REPORT.checks;
    const [finding] = shellcheck!.findings;
    const shared: RunReport = {
        ...REPORT,
        checks: [
            {
                ...shellcheck!,
                findings: [finding!, { ...finding!, line: 9 }, { ...finding!, line: 12, help: 'Quote the path.' }],
            },
        ],
    };
    const lines = stripVTControlCharacters(runText(shared, 'normal')).split('\n');
    expect(lines.filter((line) => line === '    help: Quote it.')).toHaveLength(1);
    expect(lines.indexOf('    help: Quote it.')).toBe(
        lines.indexOf('  a.sh:9:3  SC2086  Double quote to prevent globbing.') + 1,
    );
    expect(lines).toContain('    help: Quote the path.');
});

test('report colors follow the configured output mode without changing its text', () => {
    configureOutput({ verbosity: 'normal', json: false, color: false });
    const plain = runText(REPORT, 'normal');
    try {
        configureOutput({ verbosity: 'normal', json: false, color: true });
        const colored = runText(REPORT, 'normal');
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
    } finally {
        configureOutput({ verbosity: 'normal', json: false, color: false });
    }
    expect(runText(REPORT, 'normal')).toBe(plain);
});

test.each([
    { content: 'working-tree', header: 'Working tree compared with the merge base of main.\n' },
    { content: 'index', header: 'Checked the staged files.\n' },
    { content: 'commit', header: 'Checked commit main.\n' },
] satisfies ComparisonCase[])(
    'the reporter identifies $content comparisons and hides the header in quiet mode',
    ({ content, header }) => {
        const compared: RunReport = { ...REPORT, comparison: { content, reference: 'main' } };
        expect(runText(compared, 'normal')).toBe(header + runText(REPORT, 'normal'));
        expect(runText(compared, 'quiet')).toBe(runText(REPORT, 'quiet'));
    },
);

test('the reporter names the cause of a skipped check', () => {
    const skipped: RunReport = { ...REPORT, skips: [{ check: 'bash/shellcheck', cause: 'condition' }] };
    expect(runText(skipped, 'normal')).toContain('skipped    bash/shellcheck  (condition)\n');
});

test.each([
    { hook: 'pre-commit', command: 'commit' },
    { hook: 'commit-msg', command: 'commit' },
    { hook: 'pre-push', command: 'push' },
] as const)('a failed $hook report prints each reproduction once and the hook bypass', ({ hook, command }) => {
    const text = runText(REPORT, 'normal', hook);
    expect(text).toEndWith(`Bypass this hook once: git ${command} --no-verify\n`);
    expect(text.split('reproduce: gspot check --only bash/shellcheck')).toHaveLength(2);
    expect(runText({ ...REPORT, checks: [] }, 'normal', hook)).toEndWith(
        `Bypass this hook once: git ${command} --no-verify\n`,
    );
    expect(runText({ ...REPORT, exitCode: 0 }, 'normal', hook)).not.toContain('Bypass this hook');
});

test('terminal progress includes passed and skipped checks while log output keeps failures', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    const interactive = progress({ isTTY: true, write: (text) => terminal.push(text) }, 'normal');
    const redirected = progress({ isTTY: false, write: (text) => log.push(text) }, 'normal');
    const result: CheckResult = {
        check: 'example/check',
        scope: 'app',
        status: 'passed',
        fileCount: 1,
        duration: 0,
        findings: [],
    };
    for (const status of ['passed', 'skipped', 'failed', 'missing', 'error'] as const) {
        interactive({ ...result, status });
        redirected({ ...result, status });
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

test('quiet terminal progress hides successful checks but retains execution errors', () => {
    const lines: string[] = [];
    const report = progress({ isTTY: true, write: (text) => lines.push(text) }, 'quiet');
    const result: CheckResult = {
        check: 'example/check',
        scope: '',
        status: 'passed',
        fileCount: 1,
        duration: 0,
        findings: [],
    };
    report(result);
    expect(lines).toStrictEqual([]);
    report({ ...result, status: 'error' });
    expect(lines).toStrictEqual(['root  example/check  error\n']);
});
