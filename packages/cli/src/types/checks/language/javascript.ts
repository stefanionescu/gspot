// The types of checks/language/javascript in this package.
import type { EngineInput } from '#cli/types/execution/execution.ts';

export type Edge = ImportIndex['edges'][number];
export type EdgeSource = { input: EngineInput; path: string; owned: Set<string> };
export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};
