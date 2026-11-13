// pytest checks
export const COVERAGE_INI_SECTION = /^[\t ]*\[coverage:run\][\t ]*\r?$/mu;

// pytest generated config
export const NON_PYTHON_TEST_PATTERNS: ReadonlySet<string> = new Set([
    '**/*.test.*',
    '**/*.spec.*',
    '**/*Tests.swift',
    '**/__tests__/**',
]);

// test titles
export const VAGUE_TEST_TITLE_WORDS = [
    'works',
    'happy path',
    'edge case',
    'edge cases',
    'test1',
    'removed',
    'no longer',
    'anymore',
    'deprecated',
    'legacy',
] as const;
