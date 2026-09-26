// The literal values integration/cli/execution/execution reads: names, patterns, limits, and tables.

export const PREREQUISITES_POLICY =
    'version = 1\nlevel = "all"\nconfigurations = ["nextjs", "postgres", "xctest", "xcode", "static-site"]\n';
export const PAGE = '<script>\n    let count = 0;\n</script>\n<p>{count}</p>\n';
export const POLICY_FINDINGS_OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['swift/trivial-function'],
    fix: false,
    isDryRun: false,
};
export const BROKEN =
    'version = 1\nlevel = "all"\nconfigurations = ["swift"]\nrequire_reasons = true\n[[ignore]]\ncheck = "swift/trivial-function"\npaths = ["Sources/Other.swift"]\n';
export const CORRECTED = `${BROKEN}reason = "The protocol entry point forwards by design."\n`;
export const WAITING = new Map([
    ['nextjs/build', 'tools.next.build_in_gate'],
    ['postgres/migration-docs', 'tools.postgres.migration_docs'],
    ['xctest/coverage', 'tools.xctest.coverage'],
    ['xcode/entitlements-policy', 'tools.xcode.entitlements_allowed'],
    ['static-site/size', 'tools.site.size_limits'],
]);
