export const EMPTY_JSON_CASES = [
    ['', 'JSON returned no structured findings.'],
    ['noise only', 'JSON returned no structured findings.'],
    ['{ broken', 'JSON printed output that gspot cannot read.'],
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
        name: 'a missing nested list',
        output: { format: 'json', children: 'messages' },
        stdout: '[{}]',
        message: 'Required JSON report array messages is missing or invalid.',
    },
] as const;
