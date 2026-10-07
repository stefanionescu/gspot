import type { SettingDeclaration } from '#cli/types/configurations.ts';

export const DIRECTION_TEXTS: Record<SettingDeclaration['direction'], string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    neutral: 'neutral: no reason needed',
    'rule-options': 'per rule: native options; accepting a finding requires an ignore',
};

export const RULE_LOOKUP_TIMEOUT_MS = 10_000;

export const SWIFTLINT_LINE_LIMIT = 6;

export const ESLINT_RULE_PACKAGES: Record<string, string> = {
    gspot: '@gspothq/eslint-plugin',
    'typescript-eslint': 'typescript-eslint',
};
