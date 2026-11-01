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
] as const;

export const MALFORMED_SETTINGS = 'malformed = [';

export const VERSION_ARGUMENTS: readonly (readonly string[])[] = [['--version'], ['--json', '--version']] as const;
