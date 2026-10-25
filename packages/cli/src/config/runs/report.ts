import type { CHECK_STATUSES } from '#cli/config/runs/check.ts';

export const INCOMPLETE_STATUSES = new Set<(typeof CHECK_STATUSES)[number]>(['missing', 'error']);
