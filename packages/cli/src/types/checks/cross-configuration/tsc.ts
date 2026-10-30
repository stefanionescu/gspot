import type { ReadCache } from '#cli/types/system/files.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects/tsconfig.ts';

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    reads: ReadCache;
    projects: Map<string, ParsedTsconfig>;
};
