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
