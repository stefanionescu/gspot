import type { ReadCache } from '#cli/types/system/files.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/inventory.ts';

/** The TypeScript projects that a project references, and the copy where their build output goes. */
export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};

/** The project files and required options for a TypeScript tool file. */
export type PlannedTsconfig = {
    root: string;
    /**
     * The working tree with the installed packages, whose type roots the tool file lists when the check runs on a copy.
     */
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopes: ScopeFolder[];
    options: Record<string, boolean>;
};
