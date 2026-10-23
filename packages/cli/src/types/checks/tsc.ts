import type { ReadCache } from '#cli/types/system/files.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/files.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};

export type PlannedTsconfig = {
    root: string;
    typeRootsFolder: string;
    reads: ReadCache;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopes: ScopeFolder[];
    options: Record<string, boolean>;
};
