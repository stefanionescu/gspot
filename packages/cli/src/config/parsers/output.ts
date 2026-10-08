import type { OutputSpec } from '#cli/types/parsers/output.ts';

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;

export const LEADING_DOT_SLASH = /^\.\//u;

export const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;

export const DEFAULT_OUTPUT_FORMAT: OutputSpec = { format: 'regex', pattern: DEFAULT_PATTERN };

/** Semgrep's native source parsing diagnostic exit code. */
export const SEMGREP_PARSE_EXIT = 3;

/** Knip JSON categories and the meaning retained in every finding. */
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
