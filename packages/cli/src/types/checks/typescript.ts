import type { ReadCache } from '#cli/types/system/files.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';

/** Referenced compiler projects whose outputs stay inside the caller-owned scratch copy. */
export type TypeScriptReferenceCopy = {
    root: string;
    scratchRoot: string;
    reads: ReadCache;
    projects: Map<string, TypeScriptConfiguration>;
};
