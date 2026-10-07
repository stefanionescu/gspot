export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const TAIL_LINES = 20;

// These formats deliberately produce findings without a file path.
export const FILELESS_FORMATS = new Set(['lines', 'none']);
