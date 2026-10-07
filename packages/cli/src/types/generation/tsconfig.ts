import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** Project inputs and required options owned by one generated TypeScript configuration. */
export type TsconfigInput = {
    root: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopeEntries: ScopeEntry[];
    options: Record<string, boolean>;
};
