/** Argument errors that stop gspot before it reads gspot.toml, with the message of each. */
export const ARGUMENT_ERRORS = [
    { name: 'an unknown option', arguments: ['check', '--unknown'], message: "Unknown option '--unknown'" },
    {
        name: 'a missing option argument',
        arguments: ['check', '--hook'],
        message: "Option '--hook <hook>' argument missing",
    },
] as const;

/** The same argument errors with --json after them, and the message that each prints. */
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

export const COMMAND_VALUE_ERRORS = [
    {
        name: 'ignore without a check or paths',
        arguments: ['ignore', '--reason', 'Vendored sources remain outside the checks.'],
        message: 'An ignore without a check needs --paths. Name the paths to keep out of every check.',
    },
    {
        name: 'ignore with a rule but no check',
        arguments: [
            'ignore',
            '--rule',
            'SC2086',
            '--paths',
            'vendor/**',
            '--reason',
            'Vendored sources remain outside the checks.',
        ],
        message: 'An ignore without a check cannot take --rule. Name the check that owns the rule.',
    },
    {
        name: 'set with malformed TOML',
        arguments: ['set', 'ci.setup_command', '['],
        message:
            'The value [ is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.',
    },
    {
        name: 'set without an existing list reason',
        arguments: ['set', 'site.allowed_unlisted_pages', 'admin/index.html'],
        message:
            'site.allowed_unlisted_pages already has the reason "The private page belongs outside the public site map.". Pass --reason with a reason that covers every item.',
    },
    {
        name: 'set with an unnecessary reason',
        arguments: ['set', 'spelling.locale', 'en-gb', '--reason', 'The project publishes content for local readers.'],
        message:
            'spelling.locale takes no reason here: the value does not loosen the shipped default. Run the command without --reason.',
    },
] as const;

export const COMMAND_VALUE_SETTINGS = `configurations = ["site"]
[rules]
enabled = false
[site]
allowed_unlisted_pages = { value = ["private/index.html"], reason = "The private page belongs outside the public site map." }
`;
