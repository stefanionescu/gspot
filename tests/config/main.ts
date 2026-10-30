export const ARGUMENT_ERRORS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: "Option '--hook <hook>' argument missing",
    },
] as const;

export const JSON_ARGUMENT_ERRORS = [
    { name: 'no command', arguments: ['--json'], message: "Unknown option '--json'" },
    { name: 'an unknown option', arguments: ['check', '--unknown', '--json'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook', '--json'],
        message:
            "Option '--hook <hook>' argument '--json' is invalid. Allowed choices are pre-commit, pre-push, commit-msg.",
    },
] as const;

export const MALFORMED_SETTINGS = 'malformed = [';

export const VERSION_ARGUMENTS: readonly (readonly string[])[] = [
    ['--version'],
    ['--version', '--json'],
    ['--json', '--version'],
    ['init', '--version'],
    ['bogus', '--version'],
    ['check', '--fix', '--version'],
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
