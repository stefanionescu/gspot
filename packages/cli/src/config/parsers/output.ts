export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;

export const LEADING_DOT_SLASH = /^\.\//u;

export const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;

export const DEFAULT_OUTPUT_FORMAT = { format: 'regex', pattern: DEFAULT_PATTERN, file_type: 'path' } as const;

/** The exit code that Semgrep returns when it cannot parse a source file. */
export const SEMGREP_PARSE_EXIT = 3;

/** The Knip JSON finding types, and the meaning that each finding keeps. */
export const KNIP_ISSUE_TYPES = [
    'binaries',
    'catalog',
    'catalogReferences',
    'cycles',
    'dependencies',
    'devDependencies',
    'duplicates',
    'enumMembers',
    'exports',
    'files',
    'namespaceMembers',
    'nsExports',
    'nsTypes',
    'optionalPeerDependencies',
    'types',
    'unlisted',
    'unresolved',
] as const;

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

export const MARKDOWNLINT_SEVERITIES = ['error', 'warning'] as const;

export const OUTPUT_FILE_TYPES = ['path', 'link', 'history'] as const;

export const MISSING_PATH_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);
export const FILE_GROUP = '(?<file>';
export const SARIF_SOURCE_ROOT = '%SRCROOT%';
export const SEMGREP_PARSE_ERRORS: ReadonlySet<string> = new Set(['ParseError', 'PartialParsing']);
export const SEMGREP_PARSE_RULE = 'parse-error';
export const JSON_START = /[[{]/u;
