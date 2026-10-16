import type { ReadCache } from '#cli/types/system/files.ts';
import type { Scope, TrackedFile } from '#cli/types/repository/inventory.ts';

/** Project inputs and required options for a TypeScript tool file. */
export type TsconfigInput = {
    root: string;
    /** The working installation whose type roots augment a captured source project. */
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopes: Scope[];
    options: Record<string, boolean>;
};
