import type { HOLD_UNITS } from '#cli/config/generation/file-edits.ts';

/** The unit that one installer reads its release hold in. */
export type HoldUnit = (typeof HOLD_UNITS)[number];

/** Where one installer reads its release hold, and the packages it leaves out. */
export type ReleaseHold = {
    files: readonly string[];
    berry?: boolean;
    target: string;
    age: readonly string[];
    unit: HoldUnit;
    excludes?: readonly string[];
    excluded?: readonly string[];
};
