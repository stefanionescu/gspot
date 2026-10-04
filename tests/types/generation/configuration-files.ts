/** Ruff options whose generation is asserted across levels and scoped policies. */
export type RuffConfiguration = {
    lint: { select: string[]; preview: boolean; 'per-file-ignores'?: Record<string, string[]> };
    format: { preview: boolean };
};
/** Knip entries associated with the root and detected package workspaces. */
export type KnipConfiguration = { entry: string[]; workspaces: Record<string, { entry: string[] }> };
/** Stylelint rule settings read by shared framework defaults. */
export type StylelintConfiguration = { rules: Record<string, unknown> };
/** Markdown list indentation governed by the shared format width. */
export type MarkdownlintConfiguration = { MD007: { indent: number } };
/** YAML indentation governed by the shared format width. */
export type YamllintConfiguration = { rules: { indentation: { spaces: number } } };
/** The normalized severity tuples returned by a resolved ESLint configuration. */
export type ResolvedEslint = { rules: Record<string, [number, ...unknown[]]> };

/** A tested Ruff document that is required to contain runner path exclusions. */
export type TestedRuffConfiguration = RuffConfiguration & { lint: Required<RuffConfiguration['lint']> };

/** Native runtime options and rule severities resolved for one test source file. */
export type RuntimeConfiguration = ResolvedEslint & {
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
};
