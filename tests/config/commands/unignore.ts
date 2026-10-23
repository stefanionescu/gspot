export const SHELLCHECK_IGNORE = `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "Word splitting is intentional in this sandbox."
`;

export const SHELLCHECK_RULE_IGNORE = {
    tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
`,
} as const;
