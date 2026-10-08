/** The checks that read the history of the pushed commits. */
export const HISTORY_CHECKS = new Set(['commits/commitlint-pushed', 'secrets/gitleaks-pushed', 'secrets/trufflehog']);

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
