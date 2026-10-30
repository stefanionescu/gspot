export const JSON_ARGUMENT_ERRORS = [
    {
        name: 'no command',
        arguments: ['--json'],
        message: "Unknown option '--json'. Run gspot --help to see the commands.",
    },
    {
        name: 'an unknown option',
        arguments: ['check', '--unknown', '--json'],
        message: "Unknown option '--unknown'. Run gspot check --help to see its arguments and options.",
    },
    {
        name: 'a missing option argument',
        arguments: ['check', '--json', '--hook'],
        message: "Option '--hook <hook>' argument missing. Run gspot check --help to see its arguments and options.",
    },
] as const;

export const MALFORMED_SETTINGS = 'malformed = [';

export const VERSION_ARGUMENTS: readonly (readonly string[])[] = [
    ['--version'],
    ['--json', '--version'],
    ['bogus', '--version'],
] as const;

export const COMMAND_TERMS = [
    'init',
    'install',
    'apply',
    'check [paths...]',
    'add <configuration...>',
    'remove <configuration...>',
    'set <setting> <values...>',
    'unset <setting> [items...]',
    'ignore [check]',
    'unignore [check]',
    'list [configurations|settings]',
    'explain <subject>',
    'doctor',
] as const;
