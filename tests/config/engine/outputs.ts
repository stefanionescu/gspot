import { win32 } from 'node:path';

import { TYPO } from '#tests/config/setup/configurations.ts';

export const CHECK_OUTPUTS = [
    { format: 'knip', inputs: ['empty', 'foreign'] },
    { format: 'semgrep', inputs: ['empty', 'foreign'] },
    { format: 'typos', inputs: ['foreign'] },
    { format: 'vale', inputs: ['empty', 'foreign'] },
    { format: 'osv-scanner', inputs: ['empty', 'foreign'] },
] as const;

export const EDITORCONFIG_REPORT = `source.js:
	Wrong line endings or no final newline
 notes.txt:
	1: Trailing whitespace

2 errors found
`;

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

export const ESLINT_PATH_CASES: Array<[root: string, path: string, expected: string]> = [
    ['/repo', '/repository/a.js', '../repository/a.js'],
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
    ['empty list', { fix: [] }, false],
    ['list of one edit', { fix: [{ edit: 'replace' }] }, true],
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
            fixable: false,
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
