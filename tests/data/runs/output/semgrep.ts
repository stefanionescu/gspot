/** A rule match and a partial parse error in the JSON format of the pinned Semgrep. */
export const SEMGREP_MATCH = {
    check_id: 'gspot.bash.eval',
    path: 'scripts/café build.sh',
    start: { line: 2, col: 1 },
    extra: { message: 'eval runs a string as code.' },
} as const;
export const SEMGREP_PARSE_ERROR = {
    code: 3,
    type: ['PartialParsing', []],
    message: 'Syntax error in source.',
    path: 'scripts/café build.sh',
    spans: [{ file: 'scripts/café build.sh', start: { line: 1, col: 1 } }],
} as const;
