import type { Finding, CheckResult } from '#cli/types/execution/runtime.ts';

/** Expected findings owned by the root and child scope for one reader check. */
export type ScopeReaderFindings = {
    check: CheckResult['check'];
    root: Partial<Finding>[];
    nested: Partial<Finding>[];
};
