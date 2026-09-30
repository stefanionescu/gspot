// The literal values lifecycle reads: names, patterns, limits, and tables.

export const DRIFT_DIFF_CONTEXT = 2;
export const NEVER_STRAY = new Set([
    'gspot.toml',
    '.gitignore',
    '.gspot/version',
    '.gspot/reports/report.json',
    '.gspot/reports/report.sarif',
    '.gspot/reports/report.codequality.json',
    '.gspot/state/ownership.json',
    '.gspot/state/writer.lock',
]);
export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
export const MANAGED_BLOCK_START = '<!-- >>> gspot managed >>> -->';
export const MANAGED_BLOCK_END = '<!-- <<< gspot managed <<< -->';
export const HASH_BLOCK_START = '# >>> gspot managed >>>';
export const HASH_BLOCK_END = '# <<< gspot managed <<<';
// A recovery backup lives under these folders, then an operation folder, then the backed-up file.
export const RECOVERY_OWNER = ['.gspot', 'state', 'recovery'];
