// The literal values lifecycle reads: names, patterns, limits, and tables.
import { VERSION_FILE } from '#cli/config/platform/locations.ts';

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set(['gspot.toml', '.gitignore', VERSION_FILE]);

export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
