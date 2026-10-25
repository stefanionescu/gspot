export const SHELLCHECK_RULE_IGNORE = {
    tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
`,
} as const;
