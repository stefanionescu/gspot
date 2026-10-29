export const TESTING_LIBRARY_CASES = [
    ['react', '@testing-library/react'],
    ['vue', '@testing-library/vue'],
    ['svelte', '@testing-library/svelte'],
] as const;

export const JEST_RECOMMENDED_RULES = [
    'jest/no-alias-methods',
    'jest/no-done-callback',
    'jest/no-export',
    'jest/no-interpolation-in-snapshots',
    'jest/no-jasmine-globals',
    'jest/no-mocks-import',
    'jest/no-test-prefixes',
    'jest/valid-expect-in-promise',
    'jest/valid-title',
] as const;

export const ASSERTION_RULE_OWNERS = [
    { configuration: undefined, assertions: 2 },
    { configuration: 'jest', assertions: 0 },
    { configuration: 'vitest', assertions: 0 },
] as const;
