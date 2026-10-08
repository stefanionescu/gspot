export const SECURITY_DECLARATION = '[[tool]]\nname = "codeql"\nversion = "2.24.3"\n';

export const TOOL_DECLARATION = '[[tool]]\nname = "example"\nversion = "1.0.0"\n';

export const SUPPRESSION_DECLARATION =
    '[[tool]]\nname = "example"\nsuppression = { marker = "# file-disable", reason = "reason: (?<reason>.+)" }\n';

/** A fragment selector retains its file selection and reasoned path allowance without another coverage field. */
export const SYNTAX_SELECTOR_DECLARATION = `[[tool_file]]
target = ".gspot/config/eslint.config.mjs"
fragment = true
selectors = [{ selector = "CallExpression[callee.name='query']", message = "Use the declared query contract.", files = ["**/*.ts"], allowed = "drizzle.raw_sql_allowed" }]
`;

/** A convention names only direct YAML Eta packs, not unrelated configuration assets. */
export const SEMGREP_ASSETS = [
    'configurations/language/example/semgrep/first.yml.eta',
    'configurations/language/example/semgrep/second.yml.eta',
    'configurations/language/example/semgrep/not-a-pack.yml',
];
