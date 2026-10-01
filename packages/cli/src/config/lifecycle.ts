// The literal values lifecycle reads: names, patterns, limits, and tables.

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set(['gspot.toml', '.gitignore', '.gspot/version']);
// The kinds gspot adopts when the file already holds the exact bytes it writes, so a prune leaves it in place. A
// block or merged fields are taken out by themselves, gspot.toml stays, and an exported profile is the user's.
export const ADOPTED_KINDS = new Set(['config', 'hook', 'pin', 'lock']);
export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
export const MANAGED_BLOCK_START = '<!-- >>> gspot managed >>> -->';
export const MANAGED_BLOCK_END = '<!-- <<< gspot managed <<< -->';
export const HASH_BLOCK_START = '# >>> gspot managed >>>';
export const HASH_BLOCK_END = '# <<< gspot managed <<<';
