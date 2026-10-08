export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const TAIL_LINES = 20;

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
