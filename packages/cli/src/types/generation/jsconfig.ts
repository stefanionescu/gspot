import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** The authored scope and declaration exclusions for one JavaScript compiler configuration. */
export type JsconfigInput = {
    root: string;
    reads: ReadCache;
    declarationPaths: string[];
    target: string;
    scope: string;
    files: TrackedFile[];
    scopeEntries: ScopeEntry[];
    importStyles: Record<string, string>;
};
