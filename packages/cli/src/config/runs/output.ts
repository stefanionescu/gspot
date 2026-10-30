import type { CheckOutput } from '#cli/types/runs/output.ts';

export const MISSING_PATH_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);

export const FILE_GROUP = '(?<file>';

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

export const JSON_START = /[[{]/u;

export const JSON_PREVIEW_LENGTH = 80;

export const NO_OUTPUT_MESSAGE = 'The command printed nothing; it should print a JSON report.';

export const INVALID_FINDING_MESSAGE = 'The JSON report contains an invalid finding object.';

export const EMPTY_FINDING_MESSAGE = 'The JSON report contains a finding without its mapped message.';

export const KNIP_ISSUE_MESSAGES = {
    binaries: 'Unlisted binary',
    catalog: 'Unused catalog entry',
    catalogReferences: 'Unresolved catalog reference',
    cycles: 'Circular dependency',
    dependencies: 'Unused dependency',
    devDependencies: 'Unused development dependency',
    duplicates: 'Duplicate export',
    enumMembers: 'Unused exported enum member',
    exports: 'Unused export',
    files: 'Unused file',
    namespaceMembers: 'Unused exported namespace member',
    nsExports: 'Export in used namespace',
    nsTypes: 'Exported type in used namespace',
    optionalPeerDependencies: 'Referenced optional peer dependency',
    types: 'Unused exported type',
    unlisted: 'Unlisted dependency',
    unresolved: 'Unresolved import',
} as const;

export const SEMGREP_PARSE_EXIT = 3;

export const SEMGREP_PARSE_ERRORS: ReadonlySet<string> = new Set(['ParseError', 'PartialParsing']);

export const SEMGREP_PARSE_RULE = 'parse-error';

export const LEADING_DOT_SLASH = /^\.\//u;
