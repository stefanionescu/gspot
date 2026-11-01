import type { CheckStatus } from '#cli/types/engine/check.ts';

export const INCOMPLETE_STATUSES = new Set<CheckStatus>(['missing', 'error']);
