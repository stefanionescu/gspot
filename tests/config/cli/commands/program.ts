/** Commander must reject each input before repository policy can be loaded. */
export const ARGUMENT_REFUSALS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "unknown option '--unknown'" },
    { name: 'an unknown command', arguments: ['xyzzy'], message: "unknown command 'xyzzy'" },
    { name: 'an invalid hook choice', arguments: ['check', '--hook', 'before-commit'], message: 'before-commit' },
    { name: 'a missing command argument', arguments: ['add'], message: "missing required argument 'configuration'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: 'argument missing',
        jsonAfterMessage: "argument '--json' is invalid",
    },
];
