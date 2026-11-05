import { expect, test } from 'bun:test';

import { formatRunReport } from '#cli/commands/check/report.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check.ts';

test('a missing tool prints one line with its status first, and the summary counts the tool', () => {
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
    const text = formatRunReport(report, { verbose: false });
    expect(text).toContain('missing  eslint  eslint is not installed. Run gspot install.\n');
    expect(text).toContain('Missing tools: 1 (run gspot install). Passed: 0 checks.');
});
