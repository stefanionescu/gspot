export const ARGUMENT_ERRORS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: 'argument missing',
        jsonAfterMessage: "argument '--json' is invalid",
    },
] as const;
