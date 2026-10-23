export const FORMAT_OVERRIDES_SETTINGS = `level = "all"\nconfigurations = ["format", "javascript"]\n[rules]\nenabled = false\n[format]\nindent_width = 2\nquotes = "double"\nsemicolons = false\n[[format.override]]\npaths = ["tests/**"]\nquotes = "single"\nsemicolons = true\n[[format.override]]\npaths = ["apps/web/**", "!apps/web/exempt.js"]\nquotes = "single"\n[[format.override]]\npaths = ["apps/web/admin/**"]\nquotes = "double"\nsemicolons = true\nline_ending = "crlf"\n[[scope]]\npath = "apps/web"\n[scope.format]\nindent_width = 4\n[[scope]]\npath = "apps/web/admin"\n[scope.format]\nindent_width = 8\n`;

export const PRETTIER_OPTIONS_BY_FILE = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
] as const;
