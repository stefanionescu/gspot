import type { CheckStatus } from '#cli/types/execution/check.ts';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'missing', 'error']);

export const FIX_PASSES = 3;

export const FIX_DIFF_CONTEXT = 3;

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);

export const POLICY_CHECK = 'gspot/policy';
