import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** Project inputs and required options for a TypeScript tool file. */
export type TsconfigInput = {
    root: string;
    /** The verified working installation when root contains captured source. */
    installedRoot?: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopeEntries: ScopeEntry[];
    options: Record<string, boolean>;
};
