export const TEST_PATTERN = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;

/** Test frameworks whose imported expect function performs assertions. */
export const ASSERTION_MODULES = new Set(['bun:test', 'vitest', '@jest/globals']);

/** Files under conventional test directories may own assertions. */
export const TEST_DIRECTORIES = ['**/tests/**', '**/__tests__/**', '**/test/**'];
