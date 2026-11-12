import { PUSH_INPUT_MESSAGE } from '#cli/config/commands/check.ts';
import { INVALID_PUSH_INPUT_MESSAGE } from '#cli/config/repository/git.ts';

export const NAMING_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'api', configurations: ['javascript', 'naming'] },
        { path: 'web', configurations: ['javascript', 'naming'] },
    ],
} as const;

export const AUTHORED_SCRIPT = 'echo authored\n';

export const SIGNAL_EXITS = [
    { operation: 'init', signal: 'SIGINT', exitCode: 130 },
    { operation: 'checkout-index', signal: 'SIGTERM', exitCode: 143 },
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

export const PUSH_INPUT_REFUSALS = [
    {
        name: 'text that is no ref update',
        stdin: 'not a ref update\n',
        message: INVALID_PUSH_INPUT_MESSAGE,
    },
    {
        name: 'bytes that are not UTF-8',
        stdin: [INVALID_UTF8_BYTE, UTF16_MARKER_BYTE, LINE_FEED_BYTE],
        message: PUSH_INPUT_MESSAGE,
    },
] as const;

export const ARGUMENT_REFUSALS = [
    ['an empty --only list', ['check', '--only', ','], '--only'],
    ['an unknown --skip check', ['check', '--skip', 'bash/unknown'], 'bash/unknown'],
] as const;

const TEST_VERSION = '0.0.0-test';

export const FAILED_CHECK_REPORT = {
    comparison: null,
    fixes: null,
    version: TEST_VERSION,
    notes: Array.of<string>(),
    stages: ['commit', 'push'] as const,
    started: '2026-09-18T00:00:00.000Z',
    duration: 10,
    checks: [
        {
            check: 'bash/shellcheck',
            scope: '',
            status: 'failed' as const,
            fileCount: 3,
            duration: 120,
            rerun: 'gspot check --only bash/shellcheck',
            findings: [
                {
                    check: 'bash/shellcheck',
                    file: 'a.sh',
                    line: 4,
                    column: 3,
                    rule: 'SC2086',
                    message: 'Double quote to prevent globbing.',
                    help: 'Quote it.',
                    explain: 'gspot explain bash/shellcheck SC2086',
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
    skippedCount: {},
    unstagedChanges: 0,
    partial: false,
    failed: ['bash/shellcheck', 'format/prettier'],
    exitCode: 1,
} as const;

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
    note: 'The project has no .venv folder, and VIRTUAL_ENV names no environment. Create the environment with the package manager of the project, such as uv sync, or activate it, then check again.',
};

export const STAGED_PACKAGE_JSON = {
    name: 'snapshot-project',
    private: true,
    type: 'module',
    dependencies: { dependency: '1.0.0' },
} as const;

export const UPPERCASE_NOTES_MARKDOWN = '# NOTES\n';

export const SCRIPT_SPACES = 'script with spaces.sh';
