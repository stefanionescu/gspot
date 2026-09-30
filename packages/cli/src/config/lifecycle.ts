// The literal values lifecycle reads: names, patterns, limits, and tables.

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set(['gspot.toml', '.gitignore', '.gspot/version']);
// The kinds whose first write replaces a whole file that was already there, so uninstall puts the original back. A
// block or merged fields are taken out by themselves, gspot.toml stays, and an exported profile is the user's.
export const ORIGINAL_KINDS = new Set(['config', 'hook', 'pin', 'lock']);
export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
export const MANAGED_BLOCK_START = '<!-- >>> gspot managed >>> -->';
export const MANAGED_BLOCK_END = '<!-- <<< gspot managed <<< -->';
export const HASH_BLOCK_START = '# >>> gspot managed >>>';
export const HASH_BLOCK_END = '# <<< gspot managed <<<';
// A recovery backup lives under these folders, then an operation folder, then the backed-up file.
export const RECOVERY_OWNER = ['.gspot', 'state', 'recovery'];
