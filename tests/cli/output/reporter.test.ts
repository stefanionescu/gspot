import { runText } from '#cli/output/reporter.ts';
import { test, expect, describe } from 'bun:test';
import { REPORT } from '#tests/config/cli/output.ts';
import { stripVTControlCharacters } from 'node:util';
import { configureOutput } from '#cli/output/messages.ts';
import type { ComparisonCase } from '#tests/types/cli/output.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

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
        expect(runText(skipped, { quiet: true, verbose: false })).toEndWith(
            '0 checks passed, 0 checks failed, 1 check skipped, 0 findings, 0.0s\n',
        );
        expect(runText({ ...skipped, checks: [], exitCode: 2 }, { quiet: true, verbose: false })).toEndWith(
            '(incomplete)\n',
        );
        const corrected: RunReport = { ...skipped, checks: [{ ...skipped.checks[0]!, status: 'passed' }] };
        const text = runText(corrected, { quiet: false, verbose: false });
        expect(text).toEndWith('1 check passed, 0 checks failed, 0 checks skipped, 0 findings, 0.0s\n');
    });
    test('prints one line per check, findings file first with a help line, reproduce lines and the summary', () => {
        const text = runText(REPORT, { quiet: false, verbose: false });
        expect(text).toContain('root  bash/shellcheck  failed     3 files     0.1s');
        expect(text).toContain('  a.sh:4:3  SC2086  Double quote to prevent globbing.');
        expect(text).toContain('    help: Quote it.');
        expect(text).toContain('  reproduce: gspot check --only bash/shellcheck');
        expect(text).toContain('api   format/prettier  missing    prettier is not installed. Run: mise install');
        expect(text).toContain('ignores    1 (printed with --verbose)');
        expect(text).toEndWith('1 check passed, 2 checks failed, 0 checks skipped, 1 finding, 0.0s (failed)\n');
    });

    test('--quiet hides passing checks and --verbose prints ignores with reasons', () => {
        expect(runText(REPORT, { quiet: true, verbose: false })).not.toContain('bash/shfmt');
        expect(runText(REPORT, { quiet: false, verbose: false })).toContain('bash/shfmt');
        expect(runText(REPORT, { quiet: false, verbose: true })).toContain(
            'ignore     bash/shellcheck SC2312  why  (1 matched)',
        );
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
    const lines = stripVTControlCharacters(runText(shared, { quiet: false, verbose: false })).split('\n');
    expect(lines.filter((line) => line === '    help: Quote it.')).toHaveLength(1);
    expect(lines.indexOf('    help: Quote it.')).toBe(
        lines.indexOf('  a.sh:9:3  SC2086  Double quote to prevent globbing.') + 1,
    );
    expect(lines).toContain('    help: Quote the path.');
});

test('report colors follow the configured output mode without changing its text', () => {
    configureOutput({ quiet: false, json: false, color: false });
    const plain = runText(REPORT, { quiet: false, verbose: false });
    try {
        configureOutput({ quiet: false, json: false, color: true });
        const colored = runText(REPORT, { quiet: false, verbose: false });
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
    } finally {
        configureOutput({ quiet: false, json: false, color: false });
    }
    expect(runText(REPORT, { quiet: false, verbose: false })).toBe(plain);
});

test.each([
    { content: 'working-tree', header: 'Working tree compared with the merge base of main.\n' },
    { content: 'index', header: 'Checked the staged files.\n' },
    { content: 'commit', header: 'Checked commit main.\n' },
] satisfies ComparisonCase[])(
    'the reporter identifies $content comparisons and hides the header in quiet mode',
    ({ content, header }) => {
        const compared: RunReport = { ...REPORT, comparison: { content, reference: 'main' } };
        expect(runText(compared, { quiet: false, verbose: false })).toBe(
            header + runText(REPORT, { quiet: false, verbose: false }),
        );
        expect(runText(compared, { quiet: true, verbose: false })).toBe(
            runText(REPORT, { quiet: true, verbose: false }),
        );
    },
);

test('the reporter names the cause of a skipped check', () => {
    const skipped: RunReport = { ...REPORT, skips: [{ check: 'bash/shellcheck', cause: 'condition' }] };
    expect(runText(skipped, { quiet: false, verbose: false })).toContain('skipped    bash/shellcheck  (condition)\n');
});

test.each([
    { hook: 'pre-commit', command: 'commit' },
    { hook: 'commit-msg', command: 'commit' },
    { hook: 'pre-push', command: 'push' },
] as const)('a failed $hook report prints each reproduction once and the hook bypass', ({ hook, command }) => {
    const text = runText(REPORT, { quiet: false, verbose: false, hook });
    expect(text).toEndWith(`Bypass this hook once: git ${command} --no-verify\n`);
    expect(text.split('reproduce: gspot check --only bash/shellcheck')).toHaveLength(2);
    expect(runText({ ...REPORT, checks: [] }, { quiet: false, verbose: false, hook })).toEndWith(
        `Bypass this hook once: git ${command} --no-verify\n`,
    );
    expect(runText({ ...REPORT, exitCode: 0 }, { quiet: false, verbose: false, hook })).not.toContain(
        'Bypass this hook',
    );
});
