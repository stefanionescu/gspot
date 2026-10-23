import { stringify } from '@decimalturn/toml-patch';
import { TEST_VERSION } from '#tests/config/commands/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { FINDINGS_SHOWN } from '#cli/config/commands/check/report.ts';

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
            reproduce: 'gspot check api --only format/prettier',
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

/** Arguments that run only the failing and the passing check of the output sandbox. */
export const VERBOSITY_ARGUMENTS = [
    'check',
    '--only',
    'example/findings,example/passing',
    '--changed',
    'HEAD',
] as const;

/** A skipped check and a canceled check of the report. */
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

/** Each staged comparison with the notice that the report prints. */
export const COMPARISON_NOTICE_CASES = [
    { count: 1, notice: '1 file has unstaged changes that were not checked.' },
    { count: 2, notice: '2 files have unstaged changes that were not checked.' },
] as const;

export const VERBOSITY_FILES = {
    'gspot.toml': buildSandboxSettings([], {
        rules: true,
        tables: stringify({
            command_check: [
                {
                    id: 'example/findings',
                    command: [process.execPath, 'findings.ts'],
                    output: { format: 'lines' },
                    paths: ['source.txt'],
                    stage: 'commit',
                },
                {
                    id: 'example/passing',
                    command: [process.execPath, '-e', 'process.exitCode=0;'],
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
    }),
    'source.txt': 'before',
    'findings.ts': 'process.stdout.write(await Bun.file("findings.txt").text()); process.exitCode=1;',
    'findings.txt':
        Array.from({ length: FINDINGS_SHOWN + 1 }, (_, index) => `finding ${String(index + 1)}.`).join('\n') + '\n',
};

/** A duration in a report line, such as `1.2s`. */
export const DURATION = /\b\d+\.\ds\b/gu;

/**
 * Build the report of the verbosity run, with every duration written as `0.0s`.
 *
 * @param verbose whether the run printed every finding and every command.
 * @returns the report text.
 */
export function buildVerbosityReport(verbose: boolean): string {
    const total = String(FINDINGS_SHOWN + 1);
    return [
        'Checked the files changed since HEAD.',
        `example/findings  failed  ${total} findings`,
        ...(verbose ? [`  $ ${process.execPath} findings.ts`] : []),
        ...Array.from(
            { length: verbose ? FINDINGS_SHOWN + 1 : FINDINGS_SHOWN },
            (_, index) => `  finding ${String(index + 1)}.`,
        ),
        '  help: Read the command output; this repository declares the check.',
        ...(verbose ? [] : ['  and 1 more (--verbose prints every finding)']),
        '  run again: gspot check --only example/findings',
        '',
        ...(verbose
            ? ['example/passing  passed  1 file  0.0s', `  $ ${process.execPath} -e process.exitCode=0;`, '']
            : []),
        `Failed: 1 check with ${total} findings. Passed: 1 check. Skipped: 0 checks.`,
        'Time: 0.0s. Exit code 1.',
        '',
    ].join('\n');
}
