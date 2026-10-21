import { stringify } from '@decimalturn/toml-patch';
import { FINDINGS_SHOWN } from '#cli/config/commands/check.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { PUSH_CHECK_ARGUMENTS } from '#tests/data/parsers/git.ts';

export const FAILED_CHECK_REPORT = {
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

/** The fix message uses a singular noun for one changed file. */
export const FIXER_FEEDBACK_CASES = [
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
] as const;

// Options that the check command refuses, with each error; the working tree must stay unchanged.
export const FIX_REFUSALS = [
    [['--staged', '--fix'], '--fix cannot run with --staged'],
    [['--hook', 'pre-push', '--fix'], '--fix cannot run with --hook pre-push'],
] as const;

const INVALID_UTF8_BYTE = 0xff;
const UTF16_MARKER_BYTE = 0xfe;
const LINE_FEED_BYTE = 0x0a;

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
    ['a path outside the repository', ['check', '../elsewhere.txt'], 'is outside this repository'],
    ['a path that matches nothing', ['check', 'missing'], 'matches no repository files'],
    [
        'a message file that does not exist',
        ['check', '--hook', 'commit-msg', '--', 'missing-message.txt'],
        'cannot be read',
    ],
] as const;

/** Arguments that run only the failing and the passing check of the output sandbox. */
export const VERBOSITY_ARGUMENTS = [
    'check',
    '--only',
    'example/findings,example/passing',
    '--changed',
    'HEAD',
] as const;

export const PUSH_CHECK_COMMAND = [...PUSH_CHECK_ARGUMENTS, 'origin', 'unused'] as const;

export const VERBOSITY_FILES = {
    'gspot.toml': buildSandboxSettings([], {
        rules: true,
        tables: stringify({
            command_check: [
                {
                    name: 'example/findings',
                    command: [process.execPath, 'findings.ts'],
                    output: { format: 'lines' },
                    paths: ['source.txt'],
                    stage: 'commit',
                },
                {
                    name: 'example/passing',
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
