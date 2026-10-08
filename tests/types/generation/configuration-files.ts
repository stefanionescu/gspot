/** Ruff options whose generation is asserted across levels and scoped policies. */
export type RuffConfiguration = {
    lint: { select: string[]; 'per-file-ignores'?: Record<string, string[]> };
};
/** Knip entries associated with the root and detected package workspaces. */
export type KnipConfiguration = { workspaces: Record<string, { entry: string[] }> };
/** Stylelint rule settings read by shared framework defaults. */
export type StylelintConfiguration = {
    rules: Record<string, unknown>;
    overrides: { files: string[]; customSyntax: string; rules: Record<string, unknown> }[];
};
/** Stylelint parser installation follows the actual framework style consumer. */
export type StylelintConsumerCase = {
    name: string;
    configurations: string[];
    files: Record<string, string>;
    needsHtmlParser: boolean;
};
/** Markdown list indentation governed by the shared format width. */
export type MarkdownlintConfiguration = { MD007: { indent: number } };
/** YAML validates nesting consistency while the formatter owns indentation width. */
export type YamllintConfiguration = { rules: { indentation: { spaces: 'consistent' } } };
/** The normalized severity tuples returned by a computed ESLint configuration. */
export type ComputedEslint = { rules: Record<string, [number, ...unknown[]]> };

/** A tested Ruff document that is required to contain runner path exclusions. */
export type TestedRuffConfiguration = RuffConfiguration & { lint: Required<RuffConfiguration['lint']> };

/** Native runtime options and rule severities computed for one test source file. */
export type RuntimeConfiguration = ComputedEslint & {
    languageOptions: { globals: Record<string, string | boolean>; sourceType: string };
};

/** Built HTML rule severities generated for each selected site scope. */
export type HtmlValidationConfiguration = { rules: Record<string, unknown> };

/** A public HTML invocation and the diagnostic positions its native reader preserves. */
export type HtmlAccessibilityCheck = {
    check: string;
    scope: string;
    arguments: string[];
    source: string;
    preserved: string;
    configuration: string;
    findings: { file: string; line: number; column?: number; rule: string }[];
};
