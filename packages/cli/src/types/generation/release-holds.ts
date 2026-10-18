import type { HOLD_UNITS } from '#cli/config/generation/file-edits.ts';

/** The unit that one installer reads its release hold in. */
export type HoldUnit = (typeof HOLD_UNITS)[number];
