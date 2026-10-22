/** Uniform Resource Identifier delimiters and Unicode must remain literal module target names. */
export const MODULE_PATHS = ['100%', '#fragment', '?query', "author's", 'café'] as const;
export const MODULE_VALUE = { location: 'the requested module' } as const;

/** Two Markdown scopes: one with the rules of the root, one with its own code block style. */
export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;
