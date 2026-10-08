// The formatter overrides of a test repository and what each file resolves to.
/** A policy with formatter overrides at the root, for a path, and in nested scopes. */
export const FORMAT_OVERRIDES_POLICY = `level = "all"
configurations = ["format", "javascript"]
[agent_rules]
enabled = false
[format]
indent_width = 2
quotes = "double"
semicolons = false
[[format.overrides]]
paths = ["tests"]
quotes = "single"
semicolons = true
[scope."apps/web".format]
indent_width = 4
[[scope."apps/web".format.overrides]]
paths = ["**/*", "!exempt.js"]
quotes = "single"
[scope."apps/web/admin".format]
indent_width = 8
[[scope."apps/web/admin".format.overrides]]
paths = ["**/*"]
quotes = "double"
semicolons = true
line_ending = "crlf"
`;

/** Each test file and the Prettier options its overrides resolve to. */
export const FORMAT_CASES = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
];
