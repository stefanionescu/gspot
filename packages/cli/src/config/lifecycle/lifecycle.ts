// The literal values lifecycle reads: names, patterns, limits, and tables.

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set(['gspot.toml', '.gitignore', '.gspot/version']);

export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
