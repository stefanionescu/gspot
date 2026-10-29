export const SHELLCHECK_RULE_IGNORE = {
    tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
`,
} as const;

export const UPDATED_GITATTRIBUTES = 'updated  .gitattributes';

export const TOOLS_CHANGED_LINE =
    'note     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const UNMATCHED_RULE_MESSAGE = 'No change: rule SC2086 of bash/shellcheck has no matching ignore.\n';
