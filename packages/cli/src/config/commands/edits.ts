import { WEAKENING_RULES } from '#cli/config/configurations/gspot.ts';

// edit results
export const ADD_REMOVE_MESSAGE = 'Use gspot add or gspot remove to change configurations.';
export const FIX_INSTALL_MESSAGE = 'Fix that, then run gspot install.';
export const MANAGED_KEYS_NOTE =
    'Keys that gspot no longer manages stay in your files. Review your shared tool configs after you remove a configuration.';
export const REPAIRED_FILES_MESSAGE = 'gspot.toml already says this.';
export const UNCHANGED_SETTINGS_MESSAGE = 'No change: gspot.toml already says this.';

// ignore
export const IGNORE_CHECK_MESSAGE = 'Run gspot ignore <check> --reason "<why>".';

// set values
export const ENTRY_REASON_MESSAGE =
    '{key} keeps a reason for each entry. Add --reason "<why>" with why each one belongs.';
export const PREVIOUS_VALUE_LENGTH = 80;
// These keys hold no reason, so the record of why they changed is an ignore of the weakening that the change reports.
export const REASON_IGNORE_RULES: Readonly<Record<string, string>> = {
    level: WEAKENING_RULES.level,
    'hooks.enabled': WEAKENING_RULES.hooks,
    'rule_files.enabled': WEAKENING_RULES.ruleFiles,
    'rule_files.exclude': WEAKENING_RULES.ruleFiles,
};
export const TOOL_RULES_KEY = /^tools\.(?<tool>[^.]+)\.rules$/u;

// unignore
export const BARE_UNIGNORE_MESSAGE =
    'Name what to remove: run gspot unignore <check>, or gspot unignore --paths <path>.';
export const NO_CHECK_IGNORE_TEXTS = {
    unmatched: 'no ignore without a check matches',
    removed: 'without a check',
} as const;
export const RULE_WITHOUT_CHECK_MESSAGE =
    'An ignore without a check cannot take --rule. Name the check that owns the rule.';
