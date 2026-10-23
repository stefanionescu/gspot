import { win32 } from 'node:path';

export const CHECK_OUTPUTS = [
    { format: 'regex', pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$` },
    {
        format: 'grouped',
        file_pattern: String.raw`^(?<file>\S.*):$`,
        pattern: String.raw`^\s+(?<line>\d+): (?<message>.*)$`,
    },
    { format: 'lines' },
    { format: 'none' },
    { format: 'json', fields: { file: 'file', line: 'line', rule: 'rule', message: 'message' } },
    { format: 'sarif' },
    { format: 'knip' },
    { format: 'semgrep' },
    { format: 'typos' },
    { format: 'markdownlint' },
] as const;

export const FOREIGN_OUTPUT = 'not the output of any tool {\n';

export const OUTPUT_PARSE_RESULTS = {
    regex: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    grouped: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    lines: {
        empty: { findings: [] },
        foreign: {
            findings: [
                {
                    check: 'sandbox/output',
                    file: '',
                    message: 'not the output of any tool {',
                    help: 'Correct the sandbox file.',
                    fixable: false,
                },
            ],
        },
    },
    none: {
        empty: { findings: [] },
        foreign: { findings: [] },
    },
    json: {
        empty: { error: 'JSON returned no structured findings.' },
        foreign: { error: 'JSON printed output that gspot cannot read.' },
    },
    sarif: {
        empty: { error: 'SARIF printed output that gspot cannot read.' },
        foreign: { error: 'SARIF printed output that gspot cannot read.' },
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
    markdownlint: {
        empty: { error: 'Markdownlint printed output that gspot cannot read.' },
        foreign: { error: 'Markdownlint printed output that gspot cannot read.' },
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
    ['format/prettier', '[warn] source.ts', 'source.ts'],
    ['python/ruff-format', 'source.py:1:1: unformatted: different spacing', 'source.py'],
] as const;

export const ESLINT_PATH_CASES: [root: string, path: string, expected: string][] = [
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
