const EXPIRY_IGNORE = { check: 'bash/shellcheck', rule: 'SC2086', reason: 'The sandbox preserves word splitting.' };

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

export const IGNORE_REFUSALS = [
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
] as const;

export const MERGED_IGNORE_TEXT =
    'Ignored bash/shellcheck for b.sh.\nwrote    1 generated file\nremoved  1 generated file\nnote     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.\n';

export const UNIGNORE_PATH_TEXT =
    'Removed 1 path from 1 ignore for bash/shellcheck for b.sh.\nwrote    2 generated files\nnote     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.\n';

export const UNIGNORE_RULE_TEXT =
    'Removed 2 ignores for rule SC2312 of bash/shellcheck.\nwrote    1 generated file\nnote     The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.\n';

export const MERGED_IGNORE_SETTINGS =
    '#:schema ./.gspot/gspot.schema.json\n# Comment on configurations.\n#:schema ./.gspot/gspot.schema.json\nconfigurations = ["bash"]\n\n[hooks]\n# Keep the push selection.\nenabled = false\n\n[rules]\nenabled = false\n\n[[command_check]]\nid = "project/bash-syntax"\ncommand = ["bash", "-n", "{file}"]\npaths = ["**/*.sh"]\nstage = "commit"\noutput = { format = "regex", pattern = "^.*: line (?<line>\\\\d+): (?<message>.*)$" }\n\n[[ignore]]\ncheck = "bash/shellcheck"\npaths = ["a.sh"]\nreason = "The inputs demonstrate word splitting."\n';

export const LITERAL_ROUTE_CASES = [
    {
        folder: 'app/(legal)',
        path: 'app/(legal)/**',
        escaped: String.raw`app/\(legal\)/**`,
        removed: false,
    },
    {
        folder: 'app/(legal)',
        path: 'app/(legal)/**',
        escaped: String.raw`app/\(legal\)/**`,
        removed: true,
    },
    {
        folder: 'app/[id]',
        path: 'app/[id]/**',
        escaped: String.raw`app/\[id\]/**`,
        removed: false,
    },
    {
        folder: 'app/[id]',
        path: 'app/[id]/**',
        escaped: String.raw`app/\[id\]/**`,
        removed: true,
    },
] as const;
