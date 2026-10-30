import { TEST_VERSION } from '#tests/config/commands/samples.ts';

export const FAILED_CHECK_REPORT = {
    version: TEST_VERSION,
    notes: [] as string[],
    stage: 'all' as const,
    started: '2026-09-18T00:00:00.000Z',
    duration: 10,
    checks: [
        {
            check: 'bash/shellcheck',
            scope: '',
            status: 'failed' as const,
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
        { check: 'bash/shfmt', scope: '', status: 'passed' as const, fileCount: 3, duration: 20, findings: [] },
        {
            check: 'format/prettier',
            scope: 'api',
            status: 'missing' as const,
            fileCount: 1,
            duration: 0,
            findings: [],
            note: 'prettier is not installed. Run: mise install',
        },
    ],
    ignores: [{ check: 'bash/shellcheck', rule: 'SC2312', reason: 'why' }],
    unstagedChanges: 0,
    partial: false,
    failed: ['bash/shellcheck', 'format/prettier'],
    exitCode: 1,
} as const;

export const CHECK_REPORT_COMPARISONS = [
    { content: 'working-tree', header: 'Checked the files changed since main.\n' },
    { content: 'index', header: 'Checked the staged files.\n' },
    { content: 'commit', header: 'Checked commit main.\n' },
] as const;

export const NO_COLOR_SETTINGS = `configurations = []
[[ignore]]
check = "gspot/generated-files"
paths = ["absent/**"]
reason = "This path belongs to an external generated project."
`;

export const VERBOSITY_ARGUMENTS = [
    'check',
    '--only',
    'example/findings,example/passing',
    '--changed',
    'HEAD',
] as const;

export const SKIPPED_REPORT_CHECKS = [
    {
        check: 'example/skipped',
        scope: '',
        status: 'skipped',
        fileCount: 0,
        duration: 0,
        findings: [],
        note: 'disabled',
    },
] as const;

export const COMPARISON_NOTICE_CASES = [
    { count: 2, notice: '2 files have unstaged changes that were not checked.' },
] as const;

export const FINDING_LINES = Array.from({ length: 201 }, (_, index) => `finding ${String(index + 1)}.`);

export const FINDINGS_TOOL_ARGUMENTS = [...FINDING_LINES.flatMap((line) => ['--line', line]), '--exit', '1'];

export const FINDINGS_REPORT = [
    'Checked the files changed since HEAD.',
    'example/findings  failed  201 findings',
    ...FINDING_LINES.slice(0, 200).map((line) => `  ${line}`),
    '  help: Read the command output; this repository declares the check.',
    '  and 1 more (--verbose prints every finding)',
    '  run again: gspot check --only example/findings --changed HEAD',
    '',
    'Failed: 1 check with 201 findings. Passed: 1 check. Skipped: 0 checks.',
    'Time: 0.0s. Exit code 1.',
    '',
].join('\n');

export const DURATION = /\b\d+\.\ds\b/gu;
