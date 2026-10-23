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

const UNREADABLE = 'Semgrep printed output that gspot cannot read.';

const INCOMPLETE = 'Semgrep could not complete the scan: Syntax error in source.';

export const SEMGREP_REFUSED_REPORTS = [
    ['no output', '', UNREADABLE],
    ['an empty object', '{}', UNREADABLE],
    ['text that is not JSON', 'not JSON', UNREADABLE],
    ['a scanner error', JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, code: 2 }] }), INCOMPLETE],
    [
        'a rule error',
        JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, type: 'RuleParseError' }] }),
        INCOMPLETE,
    ],
    [
        'an error without a position',
        JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, spans: [] }] }),
        INCOMPLETE,
    ],
    [
        'a result on line 0',
        JSON.stringify({ results: [{ ...SEMGREP_MATCH, start: { line: 0, col: 1 } }], errors: [] }),
        UNREADABLE,
    ],
] as const;
