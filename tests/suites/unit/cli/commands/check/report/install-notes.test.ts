import { test, expect } from 'bun:test';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check/report.ts';

test('a report of selected checks keeps the install advice in the note and prints it once', () => {
    const report = {
        ...FAILED_CHECK_REPORT,
        checks: [
            {
                check: 'eslint',
                scope: '',
                status: 'missing' as const,
                fileCount: 1,
                duration: 0,
                findings: [],
                note: 'eslint is not installed. Run gspot install.',
            },
        ],
    };
    const selected = formatRunReport(report, { verbose: false, selectedOnly: true });
    expect(selected.match(/gspot install/gu)).toHaveLength(1);
    expect(selected).toContain('eslint is not installed. Run gspot install.');
});
