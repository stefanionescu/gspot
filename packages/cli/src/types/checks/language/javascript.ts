import type ts from 'typescript';
import type { CheckInput } from '#cli/types/execution/check.ts';

export type Edge = ImportIndex['edges'][number];

/** The importing source file, its resolution options, and the files its scope owns. */
export type Importer = { input: CheckInput; path: string; owned: Set<string>; options: ts.CompilerOptions };

/** Configuration owners that require each rule, grouped by source-file extension or script tag. */
export type RequiredEslintRules = Map<string, Map<string, Set<string>>>;

/** Source paths missing one required rule and the configurations that declare it. */
export type MissingEslintRule = { files: Set<string>; configurations: Set<string> };

export type ImportIndex = {
    paths: string[];
    importers: Map<string, Set<string>>;
    edges: { from: string; to: string; source: string; line: number; column: number }[];
};

/** The authored base rule key and authoritative source languages covered by one language configuration. */
export type EslintLanguageContract = { ending: string; languages: string[] };
