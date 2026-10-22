/** The exit code that Semgrep returns when it cannot parse a source file. */
export const SEMGREP_PARSE_EXIT = 3;

export const SEMGREP_PARSE_ERRORS: ReadonlySet<string> = new Set(['ParseError', 'PartialParsing']);

export const SEMGREP_PARSE_RULE = 'parse-error';
