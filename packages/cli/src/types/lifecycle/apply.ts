import type { FileObservation } from '#cli/types/platform.ts';
import type { GeneratedProposal } from '#cli/types/generation.ts';
import type { ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';

export type PublicationRequest = {
    root: string;
    rendered: GeneratedProposal;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean };
    takeover?: ReadonlyMap<string, FileObservation> | undefined;
    regenerate?: ReadonlyMap<string, FileObservation>;
};
