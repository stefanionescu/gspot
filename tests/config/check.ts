import { TYPO } from '#tests/config/spelling.ts';

/** Publish readiness after writing the complete child process identifier. */
export const SLOW_TOOL_PROGRAM =
    'require("node:fs").writeFileSync("started.tmp", String(process.pid)); require("node:fs").renameSync("started.tmp", "started.pid"); await Bun.sleep(60_000);';

/** Public correction feedback uses a singular noun for one changed file. */
export const FIXER_FEEDBACK_CASES = [
    { name: 'no changes', paths: [], preview: 'no fixer changes anything', applied: 'no fixer changed anything' },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        preview: '1 file would change',
        applied: 'fixers changed 1 file;',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        preview: '2 files would change',
        applied: 'fixers changed 2 files;',
    },
    {
        name: 'a truncated list of changed files',
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
        preview: '10 files would change',
        applied:
            'fixers changed 10 files; the changes are in the working tree and are not staged: `file-0.txt`, `file-1.txt`, `file-2.txt`, `file-3.txt`, `file-4.txt`, `file-5.txt`, `file-6.txt`, `file-7.txt` and 2 more',
    },
] as const;

// Inputs and diagnostics for command refusal and working-tree preservation cases.
export const FIX_REFUSALS = [
    [['--staged', '--fix'], 'Staged checks do not run fixers'],
    [['--hook', 'pre-push', '--fix'], 'The pre-push hook checks the pushed commits.'],
] as const;

export const PUSH_INPUT_REFUSALS = [
    {
        name: 'text that is no ref update',
        stdin: 'not a ref update\n',
        diagnostic: 'Invalid Git pre-push input. Supply every local and remote ref/object pair.',
    },
    {
        name: 'bytes that are not UTF-8',
        stdin: [0xff, 0xfe, 0x0a],
        diagnostic: 'Git sent pre-push input that is not UTF-8 text.',
    },
] as const;

export const ARGUMENT_REFUSALS = [
    ['a path outside the repository', ['check', '../elsewhere.txt'], 'is outside this repository'],
    ['a path that matches nothing', ['check', 'missing'], 'matches no repository files'],
    ['a message file that does not exist', ['check', '--message-file', 'missing-message.txt'], 'cannot be read'],
] as const;

export const VERBOSITY_CASES = [
    { name: 'normal output', flags: [], verbosity: 'normal' },
    { name: 'verbose output', flags: ['--verbose'], verbosity: 'verbose' },
] as const;

/** The output sandbox exercises only its declared failure and successful neighbor. */
export const VERBOSITY_ARGS = ['check', '--only', 'example/findings', 'example/passing', '--base', 'HEAD'] as const;

/** Native fixes leave an unresolved finding for the repeated fix and manual correction. */
export const PARTIAL_FIX_CASES = [
    {
        configuration: 'sql',
        check: 'sql/sqlfluff',
        path: 'sample.sql',
        tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
        sample: 'select  * from foo;\n',
        partial: 'SELECT * FROM foo;\n',
        corrected: 'SELECT id FROM foo;\n',
    },
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        tables: '',
        sample: `${TYPO.the} ${TYPO.whether}\n`,
        partial: `the ${TYPO.whether}\n`,
        corrected: 'the whether\n',
    },
] as const;
