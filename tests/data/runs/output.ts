import { TYPO } from '#tests/data/checks/spelling.ts';

// One output setting per format. Each carries the patterns or fields its format needs.
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

export const JSON_FORMATS = new Set(['json', 'sarif', 'knip', 'semgrep', 'typos', 'markdownlint']);

export const OTHER_TOOL_OUTPUT = 'not the output of any tool {\n';

export const EMPTY_ERRORS = new Set(['json', 'sarif', 'knip', 'semgrep', 'markdownlint']);

export const LINE_FINDINGS = [
    {
        check: 'sandbox/output',
        file: '',
        message: 'not the output of any tool {',
        help: 'Correct the sandbox file.',
        fixable: false,
    },
] as const;

export const INVALID_KNIP_REPORTS = [
    '{}',
    '{"issues":{}}',
    '{"issues":[{"file":""}]}',
    '{"issues":[{"file":"source.js","unknown":[{"name":"lost"}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":1}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":"value","line":0}]}]}',
    '{"issues":[{"file":"source.js","duplicates":[{"name":"value"}]}]}',
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

export const TYPO_REPORT = {
    type: 'typo',
    path: 'sample.txt',
    line_num: 1,
    byte_offset: 0,
    typo: TYPO.the,
    corrections: ['the'],
} as const;

export const REPORT_ERRORS = [
    {
        configuration: 'markdown',
        name: 'empty report',
        output: '',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        configuration: 'markdown',
        name: 'non-JSON text',
        output: 'not JSON',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        configuration: 'markdown',
        name: 'non-array report',
        output: '{}',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        configuration: 'markdown',
        name: 'empty rules',
        output: [{ ...MARKDOWN_REPORT, ruleNames: [] }],
        message: 'Markdownlint printed output that gspot cannot read.',
    },

    {
        configuration: 'markdown',
        name: 'invalid fix',
        output: [{ ...MARKDOWN_REPORT, fixInfo: [] }],
        message: 'Markdownlint printed output that gspot cannot read.',
    },

    {
        configuration: 'spelling',
        name: 'unfinished JSON',
        output: '{',
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        configuration: 'spelling',
        name: 'partial typo',
        output: { type: 'typo', path: 'sample.txt', typo: TYPO.the },
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        configuration: 'spelling',
        name: 'error output',
        output: { type: 'error', message: 'Read failed.' },
        message: 'Typos printed output that gspot cannot read.',
    },
    {
        configuration: 'spelling',
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
        message: 'Cannot read reported source file ../outside.txt.',
    },
    {
        configuration: 'spelling',
        name: 'outside offset',
        output: { ...TYPO_REPORT, byte_offset: 99 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
    {
        configuration: 'spelling',
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
        message: 'Cannot read reported source file missing.txt.',
    },
    {
        configuration: 'spelling',
        name: 'large offset',
        output: { ...TYPO_REPORT, byte_offset: 999 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
] as const;

export const EDITORCONFIG_REPORT = `source.js:
	Wrong line endings or no final newline
 notes.txt:
	1: Trailing whitespace

2 errors found
`;

export const CODEQL_REPORT = {
    version: '2.1.0',
    runs: [
        {
            results: [
                {
                    ruleId: 'js/sql-injection',
                    message: { text: 'This query depends on a user-provided value.' },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: 'api/src/users.ts' },
                                region: { startLine: 12 },
                            },
                        },
                    ],
                },
                {
                    ruleId: 'js/path-injection',
                    message: { text: 'This path depends on a user-provided value.' },
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'scripts/build.ts' } } }],
                },
            ],
        },
    ],
} as const;

export const CYCLIC_REPORT = {
    version: '2.1.0',
    runs: [
        {
            originalUriBaseIds: { FIRST: { uriBaseId: 'SECOND' }, SECOND: { uriBaseId: 'FIRST' } },
            results: [
                {
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'source.ts', uriBaseId: 'FIRST' } } }],
                },
            ],
        },
    ],
} as const;

export const ENCODED_REPORT = {
    version: '2.1.0',
    runs: [
        {
            defaultEncoding: 'unsupported-encoding',
            artifacts: [{ location: { uri: 'source.py' }, encoding: 'unsupported-encoding' }],
            results: [
                {
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { index: 0 },
                                region: { charOffset: 100, startLine: 3, startColumn: 2 },
                            },
                        },
                    ],
                },
            ],
        },
    ],
} as const;

export const FAILED_ANALYSES = [
    { executionSuccessful: false },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] },
] as const;

export const POSITIONLESS_RESULTS = [
    { name: 'no region', file: 'missing.py', locations: [{ physicalLocation: { artifactLocation: { index: 0 } } }] },
    {
        name: 'a negative offset',
        file: 'missing.py',
        locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: -1 } } }],
    },
    {
        name: 'an offset past the end',
        file: 'missing.py',
        locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 1000 } } }],
    },
    { name: 'no location, so it concerns the repository', file: '', locations: undefined },
] as const;

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
