// One output setting per format. Each carries the patterns or fields its format needs.
export const OUTPUTS = [
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
    { format: 'trufflehog' },
    { format: 'markdownlint' },
] as const;

export const JSON_FORMATS = new Set(['json', 'sarif', 'knip', 'semgrep', 'typos', 'trufflehog', 'markdownlint']);

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

export const SARIF_LOCATION_CASES = [
    ['repository', undefined],
    ['file', { artifactLocation: { uri: 'source.txt' }, region: { charOffset: 100 } }],
] as const;
