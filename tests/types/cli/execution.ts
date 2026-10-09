import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';

/** Expected findings owned by the root and child scope for one reader check. */
export type ScopeReaderFindings = {
    check: CheckResult['check'];
    root: Partial<Finding>[];
    nested: Partial<Finding>[];
};
