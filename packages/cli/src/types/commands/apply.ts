import type { StaleFile } from '#cli/types/apply.ts';

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

export type DryRunJson = {
    dryRun: true;
    pin: { from: string | undefined; to: string };
    stale: StaleFile[];
};
