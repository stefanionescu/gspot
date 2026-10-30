export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
