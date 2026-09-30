import { policyOf } from '#tests/support/cli/policy/text.ts';
// The literal values integration/cli/execution/execution reads: names, patterns, limits, and tables.

export const PREREQUISITES_POLICY = policyOf(['nextjs', 'postgres', 'xctest', 'xcode', 'static-site'], '', 'all');
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
export const WAITING: Record<string, string> = {
    'nextjs/build': 'tools.next.build_in_gate',
    'postgres/migration-docs': 'tools.postgres.migration_docs',
    'xctest/coverage': 'tools.xctest.coverage',
    'xcode/entitlements-policy': 'tools.xcode.entitlements_allowed',
    'static-site/size': 'tools.site.size_limits',
};
