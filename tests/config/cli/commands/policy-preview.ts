/** Authored policy for comparing previews with the same changes when published. */
export const PREVIEW_POLICY = `configurations = ["bash", "structure", "naming"]

[scope.api]
configurations = ["bash"]

[agent_rules]
enabled = false

[limits.bash]
file_lines = 180

[naming]
banned = ["dispatcher"]

[reasons]
"limits.bash.file_lines" = "Generated scripts share this size limit."

[[ignore]]
check = "bash/shellcheck"
reason = "The variables are read by sourcing scripts."
rule = "SC2034"

[[ignore]]
check = "bash/shellcheck"
paths = ["scripts/one.sh", "scripts/two.sh"]
reason = "Word lists pass through on purpose."
rule = "SC2086"
`;

/** Every policy-edit operation must preview the same policy it later writes. */
export const POLICY_PREVIEW_CASES = [
    {
        name: 'a scalar setting',
        argv: ['set', 'limits.bash.file_lines', '100'] as const,
        expected: { limits: { bash: { file_lines: 100 } } },
        absent: [],
    },
    {
        name: 'an appended list item',
        argv: ['set', 'naming.banned', 'orchestrator'] as const,
        expected: { naming: { banned: ['dispatcher', 'orchestrator'] } },
        absent: [],
    },
    {
        name: 'a replaced list',
        argv: [
            'set',
            'naming.banned',
            'orchestrator',
            '--replace',
            '--reason',
            'Keep the application vocabulary specific.',
        ] as const,
        expected: { naming: { banned: ['orchestrator'] } },
        absent: [],
    },
    {
        name: 'a removed list item',
        argv: [
            'set',
            'naming.banned',
            'dispatcher',
            '--remove',
            '--reason',
            'Dispatcher is part of the domain vocabulary.',
        ] as const,
        expected: {},
        absent: ['naming.banned'],
    },
    {
        name: 'the inherited default',
        argv: ['set', 'limits.bash.file_lines', '--default'] as const,
        expected: { naming: { banned: ['dispatcher'] } },
        absent: ['limits.bash.file_lines'],
    },
    {
        name: 'a scoped setting',
        argv: ['set', 'limits.file_lines', '100', '--scope', 'api'] as const,
        expected: { scope: { api: { limits: { file_lines: 100 } } } },
        absent: [],
    },
    {
        name: 'a merged ignore path',
        argv: [
            'ignore',
            'bash/shellcheck',
            '--rule',
            'SC2086',
            '--paths',
            'scripts/new.sh',
            '--reason',
            'Word lists pass through on purpose.',
        ] as const,
        expected: {
            ignore: [
                { check: 'bash/shellcheck', rule: 'SC2034' },
                {
                    check: 'bash/shellcheck',
                    rule: 'SC2086',
                    paths: ['scripts/one.sh', 'scripts/two.sh', 'scripts/new.sh'],
                },
            ],
        },
        absent: [],
    },
    {
        name: 'a global ignore',
        argv: ['ignore', 'bash/syntax', '--reason', 'The checked file demonstrates invalid syntax.'] as const,
        expected: {
            ignore: [
                { check: 'bash/shellcheck', rule: 'SC2034' },
                { check: 'bash/shellcheck', rule: 'SC2086' },
                { check: 'bash/syntax', reason: 'The checked file demonstrates invalid syntax.' },
            ],
        },
        absent: [],
    },
    {
        name: 'a removed ignore path',
        argv: ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--paths', 'scripts/one.sh', '--remove'] as const,
        expected: {
            ignore: [
                { check: 'bash/shellcheck', rule: 'SC2034' },
                { check: 'bash/shellcheck', rule: 'SC2086', paths: ['scripts/two.sh'] },
            ],
        },
        absent: [],
    },
    {
        name: 'a removed global ignore',
        argv: ['ignore', 'bash/shellcheck', '--rule', 'SC2034', '--remove'] as const,
        expected: {
            ignore: [{ check: 'bash/shellcheck', rule: 'SC2086', paths: ['scripts/one.sh', 'scripts/two.sh'] }],
        },
        absent: [],
    },
];

/** Preview validation must match publication validation and leave files unchanged. */
export const POLICY_PREVIEW_REFUSALS = [
    { name: 'an unknown setting', argv: ['set', 'limits.unknown', '100'] },
    { name: 'a missing value', argv: ['set', 'limits.bash.file_lines'] },
    { name: 'an invalid structured value', argv: ['set', 'naming.banned', '[broken'] },
    { name: 'a missing loosening reason', argv: ['set', 'limits.file_lines', '400'] },
    { name: 'a placeholder reason', argv: ['set', 'limits.bash.file_lines', '200', '--reason', '...'] },
    { name: 'an unknown scope', argv: ['set', 'limits.file_lines', '100', '--scope', 'web'] },
    { name: 'an unknown check', argv: ['ignore', 'bash/shelcheck', '--reason', 'Check the authored sample.'] },
    { name: 'a missing ignore reason', argv: ['ignore', 'bash/syntax'] },
    {
        name: 'an invalid ignore expiry',
        argv: ['ignore', 'bash/syntax', '--until', 'later', '--reason', 'Check the authored sample.'],
    },
];

/** Unchanged edits must not apply managed files or install tools. */
export const POLICY_PREVIEW_UNCHANGED = [
    {
        name: 'the current scalar value',
        argv: ['set', 'limits.bash.file_lines', '180', '--reason', 'Generated scripts share this size limit.'],
    },
    {
        name: 'the current ignore paths',
        argv: [
            'ignore',
            'bash/shellcheck',
            '--rule',
            'SC2086',
            '--paths',
            'scripts/one.sh',
            '--reason',
            'Word lists pass through on purpose.',
        ],
    },
    { name: 'an absent ignore', argv: ['ignore', 'bash/shellcheck', '--rule', 'SC1000', '--remove'] },
    { name: 'a selected configuration', argv: ['add', 'bash'] },
];
