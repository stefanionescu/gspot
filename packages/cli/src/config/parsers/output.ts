import type { OutputSpec } from '#cli/types/parsers/output.ts';

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;

export const LEADING_DOT_SLASH = /^\.\//u;

export const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;

export const DEFAULT_OUTPUT_FORMAT: OutputSpec = { format: 'regex', pattern: DEFAULT_PATTERN };

export const LINE_FEED = 10;

export const ESLINT_WARN = 1;
export const ESLINT_ERROR = 2;
