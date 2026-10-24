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
        "Option '--only <checks>' argument ',' is invalid. Name a check, such as --only python/ruff.",
    ],
] as const;

export const OUTSIDE_GIT_SETTINGS = `configurations = []
[[command_check]]
id = "sandbox/paths"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode=0'])}
paths = ["api/**"]
stage = "commit"
`;
