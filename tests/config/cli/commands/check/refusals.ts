// Inputs and diagnostics for command refusal and working-tree preservation cases.
export const FIX_REFUSALS = [
    [['--dry-run'], '--dry-run requires --fix.'],
    [['--staged', '--fix'], 'Staged checks do not run fixers'],
    [['--hook', 'pre-push', '--fix'], 'Pre-push object checks cannot be combined'],
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
        diagnostic: 'gspot stopped: The encoded data was not valid for encoding utf-8',
    },
    {
        name: 'an incomplete UTF-8 sequence',
        stdin: [0xc3],
        diagnostic: 'gspot stopped: The encoded data was not valid for encoding utf-8',
    },
] as const;

export const SELECTION_REFUSALS = [
    ['a path outside the repository', ['check', '../elsewhere.txt'], 'is outside this repository'],
    ['a path that matches nothing', ['check', 'missing'], 'matches no repository files'],
    ['a message file that does not exist', ['check', '--message-file', 'missing-message.txt'], 'cannot be read'],
] as const;

/** Git supplies exactly two remote arguments to a pre-push hook. */
export const PUSH_ARGUMENT_REFUSALS = [
    { name: 'a missing remote URL', arguments: ['origin'] },
    { name: 'an extra remote argument', arguments: ['origin', 'unused', 'extra'] },
];
