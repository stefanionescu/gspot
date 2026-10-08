/** The checks that read the history of the pushed commits. */
export const HISTORY_CHECKS = new Set(['commits/commitlint-range', 'secrets/gitleaks-history', 'secrets/trufflehog']);

export const COVERAGE_DIMENSIONS = ['lines', 'branches', 'functions', 'statements'] as const;

export const COVERAGE_FLAGS = new Set([
    '--cov',
    '--cov-fail-under',
    '--coverage',
    '--coverageReporters',
    '--coverageThreshold',
    '--coverage.reporter',
    '--coverage.thresholds.lines',
    '--coverage.thresholds.branches',
    '--coverage.thresholds.functions',
    '--coverage.thresholds.statements',
]);
