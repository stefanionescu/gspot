// The types of commands/apply in this package.
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};
/** The JSON a dry-run apply prints: the version pin, the drifted files, and the notes of the proposal. */
export type ApplyPreviewJson = {
    isDryRun: true;
    pin: { from: string | undefined; to: string };
    drift: DriftEntry[];
    notes: string[];
};
