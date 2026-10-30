import type { RunCache } from '#cli/types/system/cache.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects/tsconfig.ts';

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    cache: RunCache;
    projects: Map<string, ParsedTsconfig>;
};
