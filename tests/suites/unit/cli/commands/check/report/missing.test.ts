import { test, expect } from 'bun:test';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { ENVIRONMENT_CHECK, FAILED_CHECK_REPORT } from '#tests/config/commands/check/report.ts';

test.each([
    {
        name: 'keeps the hint of its own note and adds no install hint',
        checks: [ENVIRONMENT_CHECK],
        installCount: 0,
    },
    {
        name: 'says the install hint once for the notes that end with it',
        checks: [
            ENVIRONMENT_CHECK,
            { ...ENVIRONMENT_CHECK, check: 'python/ruff', note: 'ruff is not installed. Run gspot install.' },
        ],
        installCount: 1,
    },
])('a report with missing checks $name', ({ checks, installCount }) => {
    const report = { ...FAILED_CHECK_REPORT, ignores: [], failed: [], exitCode: 2, checks };
    expect(formatRunReport(report, { verbose: false }).match(/gspot install/gu) ?? []).toHaveLength(installCount);
});
