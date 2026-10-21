import type { ReadCache } from '#cli/types/system/files.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/inventory.ts';

/** Referenced compiler projects whose outputs stay inside the caller-owned copy. */
export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};

/** Project inputs and required options for a TypeScript tool file. */
export type PlannedTsconfig = {
    root: string;
    /** The working installation whose type roots augment a captured source project. */
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopes: ScopeFolder[];
    options: Record<string, boolean>;
};
