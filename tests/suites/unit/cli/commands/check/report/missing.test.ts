import { test, expect } from 'bun:test';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { ENVIRONMENT_CHECK, FAILED_CHECK_REPORT } from '#tests/config/commands/check.ts';

test('a tool that is missing in several scopes prints one line', () => {
    const missing = {
        ...ENVIRONMENT_CHECK,
        check: 'security/semgrep',
        note: 'semgrep 1.181.0 is not installed. Run gspot install.',
    };
    const report = {
        ...FAILED_CHECK_REPORT,
        ignores: [],
        failed: [],
        exitCode: 2,
        checks: [
            { ...missing, scope: '' },
            { ...missing, scope: 'api' },
        ],
    };
    const text = formatRunReport(report, { verbose: false });
    expect(text).toContain(
        'missing  semgrep 1.181.0 is not installed (security/semgrep in 2 scopes). Run gspot install.\n',
    );
    expect(text).toContain('Missing tools: 1 (run gspot install).');
});

test('the summary counts environments and errors apart from tools', () => {
    const crashed = { ...ENVIRONMENT_CHECK, check: 'python/ruff', status: 'error' as const, note: 'It stopped.' };
    const report = {
        ...FAILED_CHECK_REPORT,
        ignores: [],
        failed: [],
        exitCode: 2,
        checks: [ENVIRONMENT_CHECK, crashed],
    };
    expect(formatRunReport(report, { verbose: false })).toContain(
        'Missing environments: 1. Errors: 1. Passed: 0 checks.',
    );
});

test.each([
    {
        name: 'keeps the hint of its own note and adds no install hint',
        checks: [ENVIRONMENT_CHECK],
        installCount: 0,
    },
    {
        name: 'adds the install reminder to the summary of the tools that need it',
        checks: [
            ENVIRONMENT_CHECK,
            { ...ENVIRONMENT_CHECK, check: 'python/ruff', note: 'ruff is not installed. Run gspot install.' },
        ],
        installCount: 2,
    },
])('a report with missing checks $name', ({ checks, installCount }) => {
    const report = { ...FAILED_CHECK_REPORT, ignores: [], failed: [], exitCode: 2, checks };
    expect(formatRunReport(report, { verbose: false }).match(/gspot install/gu) ?? []).toHaveLength(installCount);
});
