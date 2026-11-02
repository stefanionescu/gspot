export const NEEDS_GIT_MESSAGE = 'gspot needs a Git repository. Run git init, then gspot init.';

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

export const VERSION_ARGUMENTS: ReadonlyArray<readonly string[]> = [['--version'], ['--json', '--version']] as const;
