export const EXPIRED_IGNORE_SETTINGS = `configurations = ["bash"]
# [[ignore]] here is a comment, not a record.

[[ "ignore" ]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "The sample preserves word splitting."
until = 2030-01-02

[[ignore]]
check = "bash/shellcheck"
rule = "SC2046"
reason = "The sample preserves command substitution."
until = 2099-01-01

[rules]
enabled = false
`;

/** The gspot/suppressions findings of an ignore past its until date. */
export const EXPIRED_IGNORE_FINDINGS = [
    {
        check: 'gspot/suppressions',
        file: 'gspot.toml',
        line: 4,
        rule: 'expired-ignore',
        message: 'This ignore of bash/shellcheck ended on 2030-01-02.',
        help: 'Fix the findings and delete the ignore with gspot unignore. To keep it, write a later until date in gspot.toml.',
        fixable: false,
    },
] as const;
