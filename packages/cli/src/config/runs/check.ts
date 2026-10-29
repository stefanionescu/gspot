export const CHECK_STATUSES = ['passed', 'failed', 'missing', 'skipped', 'error'] as const;

export const RAN_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['passed', 'failed']);
