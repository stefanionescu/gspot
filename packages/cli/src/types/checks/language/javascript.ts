import type { CheckInput } from '#cli/types/execution/check.ts';

export type Edge = ImportIndex['edges'][number];

/** The importing source file and the files its scope owns. */
export type Importer = { input: CheckInput; path: string; owned: Set<string> };

export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};
