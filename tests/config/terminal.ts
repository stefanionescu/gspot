export const ARGUMENT_ERRORS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: 'argument missing',
        jsonAfterMessage: "argument '--json' is invalid",
    },
] as const;

export const REPORT = {
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
export const CHECK_REPORT_COMPARISONS = [
    { content: 'working-tree', header: 'Checked the files changed since main.\n' },
    { content: 'index', header: 'Checked the staged files.\n' },
    { content: 'commit', header: 'Checked commit main.\n' },
] as const;

export const CHECK_REPORT_HOOKS = [
    { hook: 'pre-commit', command: 'commit' },
    { hook: 'pre-push', command: 'push' },
] as const;

export const CHECK_REPORT_STATUSES = ['passed', 'skipped', 'failed', 'missing', 'error'] as const;

export const CHECK_REPORT_PROGRESS = {
    check: 'example/check',
    scope: 'app',
    status: 'passed' as const,
    fileCount: 1,
    duration: 0,
    findings: [],
} as const;

export const NO_COLOR_SETTINGS = `configurations = []
[[ignore]]
check = "gspot/generated-files"
paths = ["absent/**"]
reason = "This path belongs to an external generated project."
`;
