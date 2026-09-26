// The literal values commands/check reads: names, patterns, limits, and tables.
import type { Stage } from '#cli/types/configurations.ts';

export const CANCELED_EXIT = 2;
export const INVALID_INPUT_EXIT = 2;
export const CHANGED_SHOWN = 8;
export const PUBLIC_STAGES: Stage[] = ['commit', 'push', 'manual'];
