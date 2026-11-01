export const NAMING_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'api', configurations: ['javascript', 'naming'] },
        { path: 'web', configurations: ['javascript', 'naming'] },
    ],
} as const;

export const ALL_FILES_BASES = [
    { reference: '', message: 'Checked every file: the base ref is empty.' },
    { reference: '0'.repeat(40), message: 'Checked every file: the base is a new branch.' },
] as const;

export const CHECK_STOPPED_MESSAGE = 'Check stopped before every check finished.';

export const AUTHORED_SCRIPT = 'echo authored\n';

export const SIGNAL_EXITS = [
    { operation: 'init', signal: 'SIGINT', exitCode: 130 },
    { operation: 'cat-file', signal: 'SIGTERM', exitCode: 143 },
] as const;

export const CANCELLATION_REPORT_CASES = [
    { signal: 'SIGINT', format: 'json' },
    { signal: 'SIGTERM', format: 'text' },
] as const;

export const PUSH_CHECK_COMMAND = [
    'check',
    '--hook',
    'pre-push',
    '--only',
    'project/bash-syntax',
    '--json',
    '--',
    'origin',
    'unused',
] as const;

const INVALID_UTF8_BYTE = 0xff;

const UTF16_MARKER_BYTE = 0xfe;

const LINE_FEED_BYTE = 0x0a;

export const FIX_REFUSALS = [
    [
        ['--staged', '--fix'],
        '--fix cannot run with --staged: fixers change the working tree, not the staged files. Run gspot check --fix, then stage the changes.',
    ],
    [
        ['--hook', 'pre-push', '--fix'],
        '--fix cannot run with --hook pre-push: it checks the pushed commits. Leave out --fix.',
    ],
] as const;

export const PUSH_INPUT_REFUSALS = [
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

export const ARGUMENT_REFUSALS = [
    [
        'a path outside the repository',
        ['check', '../elsewhere.txt'],
        'Path ../elsewhere.txt is outside this repository.',
    ],
    ['a path that matches nothing', ['check', 'missing'], 'Path missing matches no repository files.'],
    [
        'an empty --only list',
        ['check', '--only', ','],
        "Option '--only <checks>' argument ',' is invalid. Name a check, such as --only python/ruff. Run gspot check --help to see its arguments and options.",
    ],
] as const;

const TEST_VERSION = '0.0.0-test';

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

export const NO_COLOR_SETTINGS = `configurations = []
[[ignore]]
check = "gspot/generated-files"
paths = ["absent/**"]
reason = "This path belongs to an external generated project."
`;

export const VERBOSITY_ARGUMENTS = ['check', '--only', 'example/findings,example/passing', '--base', 'HEAD'] as const;

const FINDING_LINES = Array.from({ length: 201 }, (_, index) => `finding ${String(index + 1)}.`);

export const FINDINGS_TOOL_ARGUMENTS = [...FINDING_LINES.flatMap((line) => ['--line', line]), '--exit', '1'];

export const ENVIRONMENT_CHECK = {
    check: 'python/basedpyright',
    scope: '',
    status: 'missing' as const,
    fileCount: 1,
    duration: 0,
    findings: [],
    note: 'The project environment .venv is missing. Run uv sync, then check again.',
};

export const STAGED_PACKAGE_JSON = {
    name: 'snapshot-project',
    private: true,
    type: 'module',
    dependencies: { dependency: '1.0.0' },
} as const;

export const UPPERCASE_NOTES_MARKDOWN = '# NOTES\n';

export const SCRIPT_SPACES = 'script with spaces.sh';
