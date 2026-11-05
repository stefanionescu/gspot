import type { RunReport } from '#cli/types/engine/run.ts';

export const NAMING_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'api', configurations: ['javascript', 'naming'] },
        { path: 'web', configurations: ['javascript', 'naming'] },
    ],
} as const;

export const ALL_FILES_BASES = [{ reference: '' }, { reference: '0'.repeat(40) }] as const;

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

export const FIX_REFUSALS = [{ flags: ['--staged', '--fix'] }, { flags: ['--hook', 'pre-push', '--fix'] }] as const;

export const PUSH_INPUT_REFUSALS = [
    {
        name: 'text that is no ref update',
        stdin: 'not a ref update\n',
    },
    {
        name: 'bytes that are not UTF-8',
        stdin: [INVALID_UTF8_BYTE, UTF16_MARKER_BYTE, LINE_FEED_BYTE],
    },
] as const;

export const ARGUMENT_REFUSALS = [
    ['a path outside the repository', ['check', '../elsewhere.txt'], '../elsewhere.txt'],
    ['a path that matches nothing', ['check', 'missing'], 'missing'],
    ['an empty --only list', ['check', '--only', ','], '--only'],
    ['an empty --skip list', ['check', '--skip', ','], '--skip'],
    ['an unknown --skip check', ['check', '--skip', 'bash/unknown'], 'bash/unknown'],
] as const;

const TEST_VERSION = '0.0.0-test';

export const FAILED_CHECK_REPORT = {
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

export const SCAN_RUN_REPORT: RunReport = {
    notes: [],
    version: '0.0.0-test',
    stages: ['commit', 'push'],
    started: '2026-01-01T00:00:00.000Z',
    duration: 4200,
    checks: [
        {
            check: 'javascript/eslint',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 2000,
            findings: [1, 2, 3, 4].map((line) => ({
                check: 'javascript/eslint',
                file: 'src/a.ts',
                line,
                rule: 'no-console',
                message: 'Unexpected console statement.',
                fixable: false,
            })),
        },
        {
            check: 'secrets/gitleaks-staged',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 1000,
            findings: [
                {
                    check: 'secrets/gitleaks-staged',
                    file: 'src/key.ts',
                    line: 2,
                    rule: 'generic-api-key',
                    message: 'Detected a key.',
                    fixable: false,
                },
            ],
        },
        {
            check: 'format/prettier',
            scope: '',
            status: 'failed',
            fileCount: 2,
            duration: 500,
            findings: ['src/a.ts', 'src/b.ts'].map((file) => ({
                check: 'format/prettier',
                file,
                message: 'Not formatted the way Prettier formats it.',
                fixable: true,
            })),
        },
        {
            check: 'spelling/typos',
            scope: '',
            status: 'failed',
            fileCount: 1,
            duration: 500,
            findings: [
                {
                    check: 'spelling/typos',
                    file: 'README.md',
                    line: 1,
                    message: 'A word is misspelled.',
                    fixable: true,
                },
            ],
        },
        {
            check: 'secrets/environment-examples',
            scope: '',
            status: 'passed',
            fileCount: 2,
            duration: 900,
            findings: [],
        },
        {
            check: 'python/ruff',
            scope: '',
            status: 'missing',
            fileCount: 1,
            duration: 0,
            findings: [],
            note: 'ruff is not installed.',
        },
    ],
    ignores: [],
    skippedCount: {},
    unstagedChanges: 0,
    partial: false,
    failed: ['javascript/eslint', 'secrets/gitleaks-staged', 'format/prettier', 'spelling/typos'],
    exitCode: 1,
};
