// The literal values lifecycle reads: names, patterns, limits, and tables.

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set(['gspot.toml', '.gitignore', '.gspot/version']);

export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;

/** Read by everyone and written by the owner: the mode of an ordinary file. */
export const OWNER_WRITABLE_FILE = 0o644;

/** Read and run by everyone, written by the owner: the mode of a program. */
export const EXECUTABLE_FILE = 0o755;
