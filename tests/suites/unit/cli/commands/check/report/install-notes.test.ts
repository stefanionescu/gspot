import { test, expect } from 'bun:test';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check/report.ts';

test('aggregate reports print standard install advice once and preserve custom instructions', () => {
    const report = {
        ...FAILED_CHECK_REPORT,
        checks: ['eslint', 'ruff'].map((tool) => ({
            check: tool,
            scope: '',
            status: 'missing' as const,
            fileCount: 1,
            duration: 0,
            findings: [],
            note: `${tool} is not installed. Run gspot install.`,
        })),
    };
    const text = formatRunReport(report, { verbose: false });
    expect(text.match(/gspot install/gu)).toHaveLength(1);
    expect(text).toContain('eslint is not installed.');
    expect(text).toContain('ruff is not installed.');
    const selected = formatRunReport(
        { ...report, checks: report.checks.slice(0, 1) },
        { verbose: false, selectedOnly: true },
    );
    expect(selected.match(/gspot install/gu)).toHaveLength(1);
    expect(selected).toContain('eslint is not installed. Run gspot install.');
    expect(report.checks[0]?.note).toBe('eslint is not installed. Run gspot install.');
    report.checks[0]!.note = 'Install the corporate tool package from your internal registry.';
    expect(formatRunReport(report, { verbose: false })).toContain(
        'Install the corporate tool package from your internal registry.',
    );
});
