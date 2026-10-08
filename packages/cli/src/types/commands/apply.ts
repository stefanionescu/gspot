import type { Drift } from '#cli/types/lifecycle/apply.ts';

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

/** The JSON a dry-run apply prints: the version pin, the drifted files, and the notes of the plan. */
export type ApplyPlanJson = {
    dryRun: true;
    policy: string;
    reconciled: string[];
    pin: { from: string | undefined; to: string };
    drift: Drift[];
    notes: string[];
};
