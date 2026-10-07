import type { CheckStatus } from '#cli/types/execution/runtime.ts';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'missing', 'error']);

export const FIX_PASSES = 3;

export const FIX_DIFF_CONTEXT = 3;

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);

/** The check that compares the generated files with what the policy renders. */
export const GENERATED_DRIFT_CHECK = 'gspot/drift';

export const POLICY_CHECK = 'gspot/policy';
