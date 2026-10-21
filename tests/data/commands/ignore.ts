const EXPIRY_IGNORE = { check: 'bash/shellcheck', rule: 'SC2086', reason: 'The sandbox preserves word splitting.' };

/** Two ignore records for ShellCheck findings, to test removing only one. */
export const TWO_IGNORE_RECORDS = `configurations = ["bash"]
[rules]
enabled = false
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "Word lists pass through on purpose."
[[ignore]]
check = "bash/shellcheck"
rule = "SC2034"
reason = "The variables are read by sourcing scripts."
`;

/** Removal still reports a result when it only deletes an empty authored list. */
export const UNIGNORE_CASES = [
    [
        'an authored entry',
        `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "Word splitting is intentional in this sandbox."
`,
        'Removed 1 ignore for bash/shellcheck.',
    ] as const,
    ['an empty authored list', 'ignore = []\n', 'No change: bash/shellcheck has no matching ignore.'] as const,
] as const;

export const PATH_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shellcheck',
    '--reason',
    'The inputs demonstrate word splitting.',
    '--paths',
] as const;

export const DATED_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shellcheck',
    '--rule',
    'SC2086',
    '--reason',
    'The sandbox preserves word splitting.',
] as const;

export const MERGED_EXPIRY_IGNORES = [
    {
        ...EXPIRY_IGNORE,
        until: '2099-05-20',
        paths: ['a.sh', 'b.sh'],
    },
    {
        ...EXPIRY_IGNORE,
        until: '2099-05-21',
        paths: ['c.sh'],
    },
];

export const REMAINING_EXPIRY_IGNORES = [
    {
        ...EXPIRY_IGNORE,
        until: '2099-05-20',
        paths: ['a.sh'],
    },
    {
        ...EXPIRY_IGNORE,
        until: '2099-05-21',
        paths: ['c.sh'],
    },
];

export const FUNCTION_NAME_IGNORES = [
    {
        check: 'structure/trivial-functions',
        names: ['define_schema', 'execute'],
        paths: ['nodes/**'],
        reason: 'The host application calls these hooks by name.',
    },
];

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
