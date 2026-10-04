import type ts from 'typescript';
import type { EngineInput } from '#cli/types/execution/runtime.ts';

export type Edge = ImportIndex['edges'][number];

/** The importing source file, its resolution options, and the files its scope owns. */
export type Importer = { input: EngineInput; path: string; owned: Set<string>; options: ts.CompilerOptions };

/** Configuration owners that require each rule, grouped by source-file extension. */
export type RequiredEslintRules = Map<string, Map<string, Set<string>>>;

/** Source paths missing one required rule and the configurations that declare it. */
export type MissingEslintRule = { files: Set<string>; configurations: Set<string> };

export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};
