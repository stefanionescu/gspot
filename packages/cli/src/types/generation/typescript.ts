import type { ReadCache } from '#cli/types/system/files.ts';
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
    importStyle: string;
};

/** Project inputs and required options for a TypeScript tool file. */
export type TsconfigInput = {
    root: string;
    /** The working installation whose type roots augment a captured source project. */
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopeEntries: ScopeEntry[];
    options: Record<string, boolean>;
};
