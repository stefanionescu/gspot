// The literal values commands/explain reads: names, patterns, limits, and tables.

export const STAGES = ['commit', 'push', 'manual', 'message'];
export const DIRECTIONS: Record<string, string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    neutral: 'neutral: no reason needed',
    'per-rule': 'per rule: options and rules turned on; off is an ignore',
};
export const TOOL_TIMEOUT_MS = 10_000;
export const SWIFTLINT_LINES = 6;
