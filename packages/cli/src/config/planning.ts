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
