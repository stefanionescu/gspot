import { win32 } from 'node:path';

import { TYPO } from '#tests/config/setup/configurations.ts';

export const CHECK_OUTPUTS = [
    { format: 'regex', pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$` },
    {
        format: 'grouped',
        file_pattern: String.raw`^(?<file>\S.*):$`,
        pattern: String.raw`^\s+(?<line>\d+): (?<message>.*)$`,
    },
    { format: 'none' },
    { format: 'json', fields: { file: 'file', line: 'line', rule: 'rule', message: 'message' } },
    { format: 'knip' },
    { format: 'semgrep' },
    { format: 'typos' },
    { format: 'vale' },
] as const;

export const OUTPUT_PARSE_RESULTS = {
    regex: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    grouped: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    none: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    json: {
        empty: { error: 'The command printed nothing; it should print a JSON report.' },
        foreign: { error: 'The output is not JSON. It starts with: not the output of any tool {' },
    },
    knip: {
        empty: { error: 'Knip printed output that gspot cannot read.' },
        foreign: { error: 'Knip printed output that gspot cannot read.' },
    },
    semgrep: {
        empty: { error: 'Semgrep printed output that gspot cannot read.' },
        foreign: { error: 'Semgrep printed output that gspot cannot read.' },
    },
    typos: {
        empty: { findings: [] },
        foreign: { error: 'Typos printed output that gspot cannot read.' },
    },
    vale: {
        empty: { error: 'Vale printed output that gspot cannot read.' },
        foreign: { error: 'Vale printed output that gspot cannot read.' },
    },
} as const;

export const EDITORCONFIG_REPORT = `source.js:
	Wrong line endings or no final newline
 notes.txt:
	1: Trailing whitespace

2 errors found
`;

export const BRACKETED_WORD_FINDINGS = [
    {
        check: 'sandbox/diagnostic',
        file: 'a.txt',
        line: 1,
        message: 'Call the function by its full name (fetch)',
        help: '',
        fixable: false,
    },
    {
        check: 'sandbox/diagnostic',
        file: 'b.txt',
        line: 2,
        message: 'Name the type [User]',
        help: '',
        fixable: false,
    },
] as const;

export const WINDOWS_ROOT_CASES = [
    {
        root: 'C:/work',
        stdout: 'error: invalid TOML\n  ┌─ C:/work/settings.toml:2:3\n  │\n',
        stderr: '',
        line: 2,
        column: 3,
    },
    { root: '/repository', stdout: '', stderr: '  ┌─ settings.toml:2:1\n', line: 2, column: 1 },
] as const;

export const FIXABLE_FORMAT_CASES = [
    ['python/ruff-format', 'source.py:1:1: unformatted: different spacing', 'source.py'],
] as const;

export const ESLINT_PATH_CASES: Array<[root: string, path: string, expected: string]> = [
    ['/repo', '/repo/a.js', 'a.js'],
    ['/repo', '/repository/a.js', '/repository/a.js'],
    [
        win32.normalize('C:/repo'),
        win32.normalize('C:/repo/café file.js'),
        process.platform === 'win32' ? 'café file.js' : win32.normalize('C:/repo/café file.js'),
    ],
];

export const LINE_ENDING_CASES = [
    ['LF', '\n'],
    ['CRLF', '\r\n'],
] as const;

export const EMPTY_JSON_CASES = [
    ['a'.repeat(100), `: ${'a'.repeat(80)}`],
    ['{"items":null}', 'items'],
] as const;

export const TWO_LEVEL_FORMAT = {
    format: 'json' as const,
    list: 'results',
    children: ['packages', 'vulnerabilities'],
    fields: { file: 'source.path', rule: 'id', message: ['package.name', 'package.version', 'summary'] },
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
    ['null', { fix: null }, false],
] as const;

export const NESTED_LIST_FORMAT = {
    format: 'json' as const,
    list: 'files',
    children: ['violations'],
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
    },
    {
        name: 'a finding without its mapped message',
        output: { format: 'json', fields: { message: 'message' } },
        stdout: '[{}]',
    },
    {
        name: 'a nested value that is not a list',
        output: { format: 'json', children: ['messages'] },
        stdout: '[{"messages":{}}]',
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

export const SEMGREP_REFUSED_REPORTS = [
    ['a scanner error', JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, code: 2 }] })],
    ['a rule error', JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, type: 'RuleParseError' }] })],
    ['an error without a position', JSON.stringify({ results: [], errors: [{ ...SEMGREP_PARSE_ERROR, spans: [] }] })],
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
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
    },
    {
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
    },
] as const;

export const TYPOS_FINDING_CASES = [
    {
        name: 'a byte offset after Unicode text',
        source: `café ${TYPO.the}\n`,
        report: { ...TYPO_REPORT, byte_offset: 6 },
        expected: {
            file: 'sample.txt',
            line: 1,
            column: 6,
            message: `\`${TYPO.the}\` should be \`the\``,
            fixable: true,
        },
    },
    {
        name: 'several possible corrections',
        source: `${TYPO.the}\n`,
        report: { ...TYPO_REPORT, corrections: ['the', 'tea'] },
        expected: {
            file: 'sample.txt',
            line: 1,
            column: 1,
            message: `\`${TYPO.the}\` should be \`the\`, \`tea\``,
            fixable: false,
        },
    },
    {
        name: 'a misspelled file name',
        source: '',
        report: { type: 'typo', path: `${TYPO.the}.txt`, byte_offset: 0, typo: TYPO.the, corrections: ['the'] },
        expected: { file: `${TYPO.the}.txt`, message: `Filename: \`${TYPO.the}\` should be \`the\``, fixable: false },
    },
] as const;
