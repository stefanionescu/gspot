import { expect, test } from 'bun:test';

import { formatRunReport } from '#cli/commands/check/report.ts';
import { ENVIRONMENT_CHECK, FAILED_CHECK_REPORT } from '#tests/config/commands/check.ts';

test('a tool that is missing in several scopes prints one line', () => {
    const missing = {
        ...ENVIRONMENT_CHECK,
        check: 'security/semgrep',
        note: 'semgrep 0.0.0-test is not installed. Run gspot install.',
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
        'missing  semgrep 0.0.0-test is not installed (security/semgrep in 2 scopes). Run gspot install.\n',
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
    const text = formatRunReport(report, { verbose: false });
    expect(text).toContain(`missing  ${ENVIRONMENT_CHECK.check}  ${ENVIRONMENT_CHECK.note}\n`);
    expect(text).toContain('Missing environments: 1. Errors: 1. Passed: 0 checks.');
});

test('the summary counts canceled checks apart from errors', () => {
    const crashed = { ...ENVIRONMENT_CHECK, check: 'python/ruff', status: 'error' as const, note: 'It stopped.' };
    const canceled = { ...ENVIRONMENT_CHECK, check: 'bash/shellcheck', status: 'canceled' as const, note: 'Canceled.' };
    const report = { ...FAILED_CHECK_REPORT, ignores: [], failed: [], exitCode: 2, checks: [crashed, canceled] };
    const text = formatRunReport(report, { verbose: false, canceled: true });
    expect(text).toContain('canceled  bash/shellcheck  Canceled.');
    expect(text).toContain('Errors: 1. Canceled: 1 check. Passed: 0 checks.');
});
