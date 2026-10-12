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

export const FLAG_VALUE = /=.*/su;
export const LICENSES_CONFIGURATION = 'licenses';
export const STYLELINT_TOOL = 'stylelint';

export const TOOL_IGNORE_ARGUMENT = '--ignore-path';
