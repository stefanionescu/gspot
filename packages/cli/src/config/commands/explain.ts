export const STAGES = ['commit', 'push', 'manual', 'message'];

export const DIRECTION_TEXTS: Record<string, string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    neutral: 'neutral: no reason needed',
    'rule-options': 'per rule: options and rules turned on; off is an ignore',
};

export const TOOL_TIMEOUT_MS = 10_000;

export const SWIFTLINT_LINE_LIMIT = 6;

export const ESLINT_RULE_PACKAGES: Record<string, string> = {
    gspot: '@gspothq/eslint-plugin',
    'typescript-eslint': 'typescript-eslint',
};
