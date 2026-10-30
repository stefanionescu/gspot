export const PATH_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shellcheck',
    '--reason',
    'The inputs demonstrate word splitting.',
    '--paths',
] as const;

export const IGNORE_HOOK_TABLES = `[rules]
enabled = false
[hooks]
# Keep the push selection.
enabled = false
`;

export const UNKNOWN_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shelcheck',
    '--reason',
    'The sample check name is misspelled.',
] as const;

export const IGNORE_REFUSALS = [
    {
        name: 'a one-letter reason',
        arguments: ['ignore', '--paths', 'vendor/**', '--reason', 'x'],
        message: 'gspot ignore needs a reason of two or more words that says why: "x" is refused.',
    },
    {
        name: 'ignore without a check or paths',
        arguments: ['ignore', '--reason', 'Vendored sources remain outside the checks.'],
        message: '--paths: An ignore without check needs paths.',
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
        message: '--rule: An ignore without check cannot name a rule. Add the check that owns the rule.',
    },
] as const;

export const LITERAL_ROUTE_CASES = [
    {
        folder: 'app/(legal)',
        path: 'app/(legal)/**',
        escaped: String.raw`app/\(legal\)/**`,
        removed: false,
    },
    {
        folder: 'app/[id]',
        path: 'app/[id]/**',
        escaped: String.raw`app/\[id\]/**`,
        removed: true,
    },
] as const;
