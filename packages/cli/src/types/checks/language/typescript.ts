import type { ReadCache } from '#cli/types/system/files.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/files.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';

/** The TypeScript projects that a project references, and the copy where their build output goes. */
export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};

/** The project files and required options for a TypeScript config file. */
export type PlannedTsconfig = {
    root: string;
    /**
     * The working tree with the installed packages, whose type roots the config file lists when the check runs on a copy.
     */
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopes: ScopeFolder[];
    options: Record<string, boolean>;
};
