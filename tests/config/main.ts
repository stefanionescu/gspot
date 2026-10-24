export const ARGUMENT_ERRORS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: "Option '--hook <hook>' argument missing",
    },
] as const;

export const JSON_ARGUMENT_ERRORS = [
    { name: 'an extra version option', arguments: ['--version', '--json'], message: "Unknown option '--json'" },
    { name: 'no command', arguments: ['--json'], message: "Unknown option '--json'" },
    { name: 'an unknown option', arguments: ['check', '--unknown', '--json'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook', '--json'],
        message:
            "Option '--hook <hook>' argument '--json' is invalid. Allowed choices are pre-commit, pre-push, commit-msg.",
    },
] as const;
