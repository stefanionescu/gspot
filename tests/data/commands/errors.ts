export const ARGUMENT_ERRORS = [
    { name: 'no command', arguments: [], message: 'Usage: gspot', jsonAfterMessage: "Unknown option '--json'" },
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: 'argument missing',
        jsonAfterMessage: "argument '--json' is invalid",
    },
] as const;
