export const CHECK_STATUSES = ['passed', 'failed', 'missing', 'skipped', 'error'] as const;

export const FAILED_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['failed', 'missing', 'error']);

export const FIX_PASSES = 3;

export const FIX_DIFF_CONTEXT = 3;

export const RAN_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['passed', 'failed']);

/** Optional native process concurrency override. */
export const JOBS_VARIABLE = 'GSPOT_JOBS';

export const INCOMPLETE_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['missing', 'error']);
