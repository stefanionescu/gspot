import type { RunCache } from '#cli/types/system/system.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects.ts';

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    cache: RunCache;
    projects: Map<string, ParsedTsconfig>;
};
