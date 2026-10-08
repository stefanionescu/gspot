export const SECURITY_DECLARATION = '[[tool]]\nname = "codeql"\nversion = "2.24.3"\n';

export const TOOL_DECLARATION = '[[tool]]\nname = "example"\nversion = "1.0.0"\n';

export const SUPPRESSION_DECLARATION =
    '[[tool]]\nname = "example"\n[tool.suppression]\nmarker = "# file-disable"\nreason = "reason: (?<reason>.+)"\n';

/** A fragment selector retains its file selection and reasoned path allowance without another coverage field. */
export const SYNTAX_SELECTOR_DECLARATION = `[[config]]
target = ".gspot/config/eslint.config.mjs"
fragment = true
[[config.selectors]]
selector = "CallExpression[callee.name='query']"
message = "Use the declared query contract."
files = ["**/*.ts"]
allowed = "drizzle.raw_sql_allowed"
`;
