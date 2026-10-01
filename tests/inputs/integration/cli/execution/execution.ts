import { policyOf } from '#tests/support/cli/policy/text.ts';
// The literal values integration/cli/execution/execution reads: names, patterns, limits, and tables.

export const PAGE = '<script>\n    let count = 0;\n</script>\n<p>{count}</p>\n';
export const POLICY_FINDINGS_OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['swift/trivial-function'],
    fix: false,
    isDryRun: false,
};
export const BROKEN = policyOf(
    ['swift'],
    'require_reasons = true\n[[ignore]]\ncheck = "swift/trivial-function"\npaths = ["Sources/Other.swift"]\n',
    'all',
);
export const CORRECTED = `${BROKEN}reason = "The protocol entry point forwards by design."\n`;
