export const OUT_OF_MEMORY = /JavaScript heap out of memory|Reached heap limit/u;

/** Leave room below the 8191-character limit of cmd.exe for the npm wrapper. */
export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const TAIL_LINES = 20;
