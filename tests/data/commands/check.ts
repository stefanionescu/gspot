import { PUSH_CHECK_ARGUMENTS } from '#tests/data/parsers/git.ts';

const FAILED_CHECK_REPORT = {
    version: '0.1.0',
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
    ignores: [{ check: 'bash/shellcheck', rule: 'SC2312', reason: 'why', matched: 1 }],
    skips: [],
    unstagedChanges: 0,
    partial: false,
    failed: ['bash/shellcheck', 'format/prettier'],
    exitCode: 1,
} as const;

const CHECK_REPORT_COMPARISONS = [
    { content: 'working-tree', header: 'Checked the files changed since main.\n' },
    { content: 'index', header: 'Checked the staged files.\n' },
    { content: 'commit', header: 'Checked commit main.\n' },
] as const;

const CHECK_REPORT_HOOKS = [
    { hook: 'pre-commit', command: 'commit' },
    { hook: 'pre-push', command: 'push' },
] as const;

const CHECK_REPORT_STATUSES = ['passed', 'skipped', 'failed', 'missing', 'error'] as const;

const NO_COLOR_SETTINGS = `configurations = []
[[ignore]]
check = "gspot/generated-files"
paths = ["absent/**"]
reason = "This path belongs to an external generated project."
`;

/** Public correction feedback uses a singular noun for one changed file. */
const FIXER_FEEDBACK_CASES = [
    { name: 'no changes', paths: [], preview: 'No fixer changes anything.', applied: 'No fixer changed anything.' },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        preview: '1 file would change.',
        applied: 'fixed 1 file: source.txt. The changes are not staged.',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        preview: '2 files would change.',
        applied: 'fixed 2 files: other.txt, source.txt. The changes are not staged.',
    },
    {
        name: 'ten changed files',
        paths: [
            'file-0.txt',
            'file-1.txt',
            'file-2.txt',
            'file-3.txt',
            'file-4.txt',
            'file-5.txt',
            'file-6.txt',
            'file-7.txt',
            'file-8.txt',
            'file-9.txt',
        ],
        preview: '10 files would change.',
        applied:
            'fixed 10 files: file-0.txt, file-1.txt, file-2.txt, file-3.txt, file-4.txt, file-5.txt, file-6.txt, file-7.txt, file-8.txt, file-9.txt. The changes are not staged.',
    },
] as const;

// Inputs and diagnostics for command refusal and working-tree preservation cases.
const FIX_REFUSALS = [
    [['--staged', '--fix'], '--fix cannot run with --staged'],
    [['--hook', 'pre-push', '--fix'], '--fix cannot run with --hook pre-push'],
] as const;

const INVALID_UTF8_BYTE = 0xff;
const UTF16_MARKER_BYTE = 0xfe;
const LINE_FEED_BYTE = 0x0a;

const PUSH_INPUT_REFUSALS = [
    {
        name: 'text that is no ref update',
        stdin: 'not a ref update\n',
        message: 'Invalid Git pre-push input. Supply every local and remote ref/object pair.',
    },
    {
        name: 'bytes that are not UTF-8',
        stdin: [INVALID_UTF8_BYTE, UTF16_MARKER_BYTE, LINE_FEED_BYTE],
        message: 'Git sent pre-push input that is not UTF-8 text.',
    },
] as const;

const ARGUMENT_REFUSALS = [
    ['a path outside the repository', ['check', '../elsewhere.txt'], 'is outside this repository'],
    ['a path that matches nothing', ['check', 'missing'], 'matches no repository files'],
    [
        'a message file that does not exist',
        ['check', '--hook', 'commit-msg', '--', 'missing-message.txt'],
        'cannot be read',
    ],
] as const;

const VERBOSITY_CASES = [
    { name: 'normal output', flags: [], verbosity: 'normal' },
    { name: 'verbose output', flags: ['--verbose'], verbosity: 'verbose' },
] as const;

/** The output sandbox exercises only its declared failure and successful neighbor. */
const VERBOSITY_ARGUMENTS = ['check', '--only', 'example/findings', 'example/passing', '--changed', 'HEAD'] as const;

const PUSH_CHECK_COMMAND = [...PUSH_CHECK_ARGUMENTS, 'origin', 'unused'] as const;

export {
    FIX_REFUSALS,
    VERBOSITY_CASES,
    ARGUMENT_REFUSALS,
    NO_COLOR_SETTINGS,
    CHECK_REPORT_HOOKS,
    PUSH_CHECK_COMMAND,
    FAILED_CHECK_REPORT,
    PUSH_INPUT_REFUSALS,
    VERBOSITY_ARGUMENTS,
    FIXER_FEEDBACK_CASES,
    CHECK_REPORT_STATUSES,
    CHECK_REPORT_COMPARISONS,
};
