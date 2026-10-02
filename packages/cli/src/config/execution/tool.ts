// The literal values execution/tool reads: names, patterns, limits, and tables.
import type { OutputFormat } from '#cli/types/execution/tool.ts';

// The literal values execution reads: names, patterns, limits, and tables.

export const WINDOWS_COMMAND_LIMIT = 7000;
export const UNIX_COMMAND_LIMIT = 100_000;
export const WINDOWS_ESCAPE_EXPANSION = 5;
export const WINDOWS_ARGUMENT_OVERHEAD = 9;
export const COMMAND_CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;
export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;
export const WORKSPACE_PREFIX = '{workspace:';

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;
export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';

// These formats have no file in their findings by design, so a finding with no file says nothing about the tool.
export const FILELESS_FORMATS = new Set(['lines', 'none']);
export const TAIL_LINES = 20;
export const TRUFFLEHOG_FINDINGS = 183;

export const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
export const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

/** A project manifest marks a folder whose installed dependencies a scratch copy carries. */
export const PROJECT_MANIFESTS = ['package.json', 'pyproject.toml'];

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;
export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;
export const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;

// A `./` a tool puts before a relative path.
export const LEADING_DOT_SLASH = /^\.\//u;
export const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = { format: 'regex', pattern: DEFAULT_PATTERN };
export const LINE_FEED = 10;

/** The permission bits of a mode, without the file type. */
export const PERMISSION_BITS = 0o777;
