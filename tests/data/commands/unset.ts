/** Each unset command that exits 2 and leaves gspot.toml unchanged, with a part of its message. */
export const UNSET_REFUSALS = [
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    { commandArguments: ['unset', 'no_such_key'], message: 'no_such_key' },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list or a table, so it takes no items. Run gspot unset level.',
    },
] as const;
