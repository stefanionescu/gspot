export const EMPTY_JSON_CASES = [
    ['', 'The command printed nothing; it should print a JSON report.'],
    [' \n\t', 'The command printed nothing; it should print a JSON report.'],
    ['noise only', 'The output is not JSON. It starts with: noise only'],
    ['\n \nfirst line\nsecond line', 'The output is not JSON. It starts with: first line'],
    ['a'.repeat(100), `The output is not JSON. It starts with: ${'a'.repeat(80)}`],
    ['{ broken', 'The output is not JSON. It starts with: { broken'],
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
