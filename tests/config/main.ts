export const JSON_ARGUMENT_ERRORS = [
    {
        name: 'no command',
        arguments: ['--json'],
    },
    {
        name: 'an unknown option',
        arguments: ['check', '--unknown', '--json'],
    },
] as const;

export const MALFORMED_SETTINGS = 'malformed = [';

export const VERSION_ARGUMENTS: readonly (readonly string[])[] = [['--version'], ['--json', '--version']] as const;
