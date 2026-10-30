import type { CheckStatus } from '#cli/types/runs/check.ts';

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);
