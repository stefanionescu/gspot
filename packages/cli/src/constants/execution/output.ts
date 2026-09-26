// The literal values execution/output reads: names, patterns, limits, and tables.
import type { OutputFormat } from '#cli/types/configurations.ts';

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;
export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;
export const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;
export const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = { format: 'regex', pattern: DEFAULT_PATTERN };
export const LINE_FEED = 10;
