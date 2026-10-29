export const COVERAGE_DIMENSIONS = ['lines', 'branches', 'functions', 'statements'] as const;

export const ROOT_RUNS = ['once', 'history'] as const;

export const COVERAGE_INI_SECTION = /^[\t ]*\[coverage:run\][\t ]*\r?$/mu;
