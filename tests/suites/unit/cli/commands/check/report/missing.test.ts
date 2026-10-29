import { test, expect } from 'bun:test';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check/report.ts';

const ENVIRONMENT_CHECK = {
    check: 'python/basedpyright',
    scope: '',
    status: 'missing' as const,
    fileCount: 1,
    duration: 0,
    findings: [],
    note: 'The project environment .venv is missing. Run uv sync, then check again.',
};

test.each([
    {
        name: 'keeps the hint of its own note and adds no install hint',
        checks: [ENVIRONMENT_CHECK],
        lines: [
            'missing  python/basedpyright',
            '  The project environment .venv is missing. Run uv sync, then check again.',
            '',
            'Could not run: 1 check. Passed: 0 checks. Skipped: 0 checks.',
        ],
    },
    {
        name: 'says the install hint once for the notes that end with it',
        checks: [
            ENVIRONMENT_CHECK,
            { ...ENVIRONMENT_CHECK, check: 'python/ruff', note: 'ruff is not installed. Run gspot install.' },
        ],
        lines: [
            'missing  python/basedpyright',
            '  The project environment .venv is missing. Run uv sync, then check again.',
            '',
            'missing  python/ruff',
            '  ruff is not installed.',
            '',
            'Could not run: 2 checks (a tool is missing; run gspot install). Passed: 0 checks. Skipped: 0 checks.',
        ],
    },
])('a report with missing checks $name', ({ checks, lines }) => {
    const report = { ...FAILED_CHECK_REPORT, ignores: [], failed: [], exitCode: 2, checks };
    expect(formatRunReport(report, { verbose: false })).toBe(`${lines.join('\n')}\nTime: 0.0s. Exit code 2.\n`);
});
