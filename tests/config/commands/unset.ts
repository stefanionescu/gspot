export const UNSET_REFUSALS = [
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    {
        commandArguments: ['unset', 'no_such_key'],
        message:
            'No selected configuration has the setting no_such_key. The settings that exist at the top level are level, tool_timeout_seconds, test_files, hooks, ci, rules, tools, dependencies and 10 more. Run gspot list settings to see every one.',
    },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list or a table, so it takes no items. Run gspot unset level.',
    },
] as const;
