import { stringify } from '@decimalturn/toml-patch';
import { TEST_VERSION } from '#tests/config/commands/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { FINDINGS_SHOWN } from '#cli/config/commands/check/report.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

export const FAILED_CHECK_REPORT = {
    version: TEST_VERSION,
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

export const FAILED_REPORT_TEXT =
    'bash/shellcheck  failed  1 finding\n  a.sh:4:3  SC2086  Double quote to prevent globbing.\n  help: Quote it.\n  run again: gspot check --only bash/shellcheck\n\napi  format/prettier  missing  prettier is not installed. Run: mise install\n\nignores    1 (printed with --verbose)\nFailed: 1 check with 1 finding. Could not run: 1 check (a tool is missing; run gspot install). Passed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 1.\n';

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
    { count: 1, notice: '1 file has unstaged changes that were not checked.' },
    { count: 2, notice: '2 files have unstaged changes that were not checked.' },
] as const;

const FINDING_LINES = Array.from({ length: FINDINGS_SHOWN + 1 }, (_, index) => `finding ${String(index + 1)}.`);

const FINDINGS_COMMAND = buildProgramCommand(
    'fakes/tool',
    ...FINDING_LINES.flatMap((line) => ['--line', line]),
    '--exit',
    '1',
);

const PASSING_COMMAND = buildProgramCommand('fakes/tool');

export const VERBOSITY_FILES = {
    'gspot.toml': buildSandboxSettings([], {
        rules: true,
        tables: stringify({
            command_check: [
                {
                    id: 'example/findings',
                    command: FINDINGS_COMMAND,
                    output: { format: 'lines' },
                    paths: ['source.txt'],
                    stage: 'commit',
                },
                {
                    id: 'example/passing',
                    command: PASSING_COMMAND,
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
    }),
    'source.txt': 'before',
};

export const FINDINGS_REPORT = [
    'Checked the files changed since HEAD.',
    `example/findings  failed  ${String(FINDINGS_SHOWN + 1)} findings`,
    ...FINDING_LINES.slice(0, FINDINGS_SHOWN).map((line) => `  ${line}`),
    '  help: Read the command output; this repository declares the check.',
    '  and 1 more (--verbose prints every finding)',
    '  run again: gspot check --only example/findings --changed HEAD',
    '',
    `Failed: 1 check with ${String(FINDINGS_SHOWN + 1)} findings. Passed: 1 check. Skipped: 0 checks.`,
    'Time: 0.0s. Exit code 1.',
    '',
].join('\n');

export const VERBOSE_FINDINGS_REPORT = [
    'Checked the files changed since HEAD.',
    `example/findings  failed  ${String(FINDINGS_SHOWN + 1)} findings`,
    `  $ ${FINDINGS_COMMAND.join(' ')}`,
    ...FINDING_LINES.map((line) => `  ${line}`),
    '  help: Read the command output; this repository declares the check.',
    '  run again: gspot check --only example/findings --changed HEAD',
    '',
    'example/passing  passed  1 file  0.0s',
    `  $ ${PASSING_COMMAND.join(' ')}`,
    '',
    `Failed: 1 check with ${String(FINDINGS_SHOWN + 1)} findings. Passed: 1 check. Skipped: 0 checks.`,
    'Time: 0.0s. Exit code 1.',
    '',
].join('\n');

export const DURATION = /\b\d+\.\ds\b/gu;
