import type { CheckStatus } from '#cli/types/runs/check.ts';

export const INCOMPLETE_STATUSES = new Set<CheckStatus>(['missing', 'error']);
