// Report data covers findings, unavailable tools, successful checks, and ignored rules.
import type { RunReport } from '#cli/types/execution/runtime.ts';

export const REPORT: RunReport = {
    version: '0.1.0',
    stage: 'all',
    started: '2026-09-18T00:00:00.000Z',
    duration: 10,
    checks: [
        {
            check: 'bash/shellcheck',
            scope: '',
            status: 'failed',
            fileCount: 3,
            duration: 120,
            reproduce: 'gspot check --only bash/shellcheck',
            findings: [
                {
                    check: 'bash/shellcheck',
                    file: 'a.sh',
                    line: 4,
                    column: 3,
                    rule: 'SC2086',
                    message: 'Double quote to prevent globbing.',
                    help: 'Quote it.',
                    fixable: false,
                },
            ],
        },
        { check: 'bash/shfmt', scope: '', status: 'passed', fileCount: 3, duration: 20, findings: [] },
        {
            check: 'format/prettier',
            scope: 'api',
            status: 'missing',
            fileCount: 1,
            duration: 0,
            findings: [],
            note: 'prettier is not installed. Run: mise install',
            reproduce: 'gspot check api --only format/prettier',
        },
    ],
    ignores: [{ check: 'bash/shellcheck', rule: 'SC2312', reason: 'why', matched: 1 }],
    skips: [],
    unstagedChanges: 0,
    partial: false,
    failed: ['bash/shellcheck', 'format/prettier'],
    exitCode: 1,
};
