import type { CheckSpec } from '#cli/types/configurations.ts';

// One output setting per format. Each carries the patterns or fields its format needs.
export const OUTPUTS: NonNullable<CheckSpec['output']>[] = [
    { format: 'regex', pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$` },
    {
        format: 'grouped',
        file_pattern: String.raw`^(?<file>\S.*):$`,
        pattern: String.raw`^\s+(?<line>\d+): (?<message>.*)$`,
    },
    { format: 'lines' },
    { format: 'none' },
    { format: 'json', fields: { file: 'file', line: 'line', rule: 'rule', message: 'message' } },
    { format: 'eslint' },
    { format: 'semgrep' },
    { format: 'typos' },
    { format: 'trufflehog-json' },
    { format: 'markdownlint' },
];

export const JSON_FORMATS = new Set(['json', 'eslint', 'semgrep', 'typos', 'trufflehog-json', 'markdownlint']);

export const FOREIGN = 'not the output of any tool {\n';
