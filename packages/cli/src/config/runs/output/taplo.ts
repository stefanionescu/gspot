import type { CheckOutput } from '#cli/types/runs/output/formats.ts';

export const TAPLO_OUTPUTS = [
    {
        format: 'regex',
        pattern: String.raw`^\s*┌─ (?<file>(?:[A-Za-z]:)?[^:]+):(?<line>\d+):(?<column>\d+)$`,
        message: 'The file does not parse as TOML.',
    },
    {
        format: 'regex',
        pattern:
            '^(?:--- a/(?<file>.+)|ERROR taplo:format_files: the file is not properly formatted path="(?<file>[^"]+)")$',
        message: 'Not formatted the way Taplo formats it.',
        fixable: '^(?:--- a/|ERROR taplo:format_files)',
    },
] satisfies CheckOutput[];
