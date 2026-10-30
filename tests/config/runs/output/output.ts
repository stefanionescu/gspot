import { TYPO } from '#tests/config/spelling.ts';

export const EMPTY_JSON_CASES = [
    [' \n\t', 'The command printed nothing; it should print a JSON report.'],
    ['\n \nfirst line\nsecond line', 'The output is not JSON. It starts with: first line'],
    ['a'.repeat(100), `The output is not JSON. It starts with: ${'a'.repeat(80)}`],
    ['{"items":null}', 'Required JSON report array items is missing or invalid.'],
] as const;

export const TWO_LEVEL_FORMAT = {
    format: 'json' as const,
    list: 'results',
    children: 'packages.vulnerabilities',
    fields: { file: 'source.path', rule: 'id', message: 'package.name package.version summary' },
} as const;

export const NESTED_LIST_OUTPUT = {
    results: [
        {
            source: { path: 'bun.lock' },
            packages: [
                {
                    package: { name: 'qs', version: '6.15.3' },
                    vulnerabilities: [{ id: 'GHSA-1', summary: 'Denial of service.' }],
                },
            ],
        },
    ],
} as const;

export const FIX_FIELD_CASES = [
    ['absent', {}, false],
    ['object', { fix: { range: [0, 1], text: '' } }, true],
    ['null', { fix: null }, true],
    ['false', { fix: false }, true],
] as const;

export const NESTED_LIST_FORMAT = {
    format: 'json' as const,
    list: 'files',
    children: 'violations',
    fields: { file: 'filepath', line: 'start_line_no', rule: 'code', message: 'description' },
} as const;

export const FLAT_JSON_FINDINGS = [
    {
        check: 'nginx/gixy',
        file: 'nginx.conf',
        line: 9,
        rule: 'ssrf',
        message: 'Possible SSRF.',
        help: 'help',
        fixable: false,
    },
] as const;

export const INVALID_FINDING_REPORTS = [
    {
        name: 'a null finding',
        output: { format: 'json' },
        stdout: '[null]',
        message: 'The JSON report contains an invalid finding object.',
    },
    {
        name: 'a finding without its mapped message',
        output: { format: 'json', fields: { message: 'message' } },
        stdout: '[{}]',
        message: 'The JSON report contains a finding without its mapped message.',
    },
    {
        name: 'a nested value that is not a list',
        output: { format: 'json', children: 'messages' },
        stdout: '[{"messages":{}}]',
        message: 'Required JSON report array messages is missing or invalid.',
    },
] as const;

export const MARKDOWN_REPORT = {
    fileName: 'sample.md',
    lineNumber: 1,
    ruleNames: ['MD033'],
    ruleDescription: 'Inline HTML',
    errorDetail: 'Element: span',
    errorContext: null,
    errorRange: [1, 6],
    fixInfo: null,
    severity: 'error',
} as const;

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
    ['an empty object', '{}', UNREADABLE],
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

export const TYPO_REPORT = {
    type: 'typo',
    path: 'sample.txt',
    line_num: 1,
    byte_offset: 0,
    typo: TYPO.the,
    corrections: ['the'],
} as const;

export const TYPOS_REPORT_ERRORS = [
    {
        name: 'partial typo',
        output: { type: 'typo', path: 'sample.txt', typo: TYPO.the },
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
        message: 'Cannot read reported source file ../outside.txt.',
    },
    {
        name: 'outside offset',
        output: { ...TYPO_REPORT, byte_offset: 99 },
        message: 'typos reported a position outside the file: sample.txt',
    },
    {
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
        message: 'Cannot read reported source file missing.txt.',
    },
] as const;

export const TYPOS_FINDING_CASES = [
    {
        name: 'a byte offset after Unicode text',
        source: 'café te\u0068\n',
        report: { ...TYPO_REPORT, byte_offset: 6 },
        expected: { file: 'sample.txt', line: 1, column: 6, message: '`te\u0068` should be `the`', fixable: true },
    },
    {
        name: 'several possible corrections',
        source: 'te\u0068\n',
        report: { ...TYPO_REPORT, corrections: ['the', 'tea'] },
        expected: {
            file: 'sample.txt',
            line: 1,
            column: 1,
            message: '`te\u0068` should be `the`, `tea`',
            fixable: false,
        },
    },
    {
        name: 'a misspelled file name',
        source: '',
        report: { type: 'typo', path: 'te\u0068.txt', byte_offset: 0, typo: 'te\u0068', corrections: ['the'] },
        expected: { file: 'te\u0068.txt', message: 'Filename: `te\u0068` should be `the`', fixable: false },
    },
] as const;
