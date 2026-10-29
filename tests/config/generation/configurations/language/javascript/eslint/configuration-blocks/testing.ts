export const TESTING_LIBRARY_CASES = [
    ['react', '@testing-library/react'],
    ['vue', '@testing-library/vue'],
    ['svelte', '@testing-library/svelte'],
] as const;

export const ASSERTION_RULE_OWNERS = [
    { configuration: undefined, assertions: 2 },
    { configuration: 'jest', assertions: 0 },
    { configuration: 'vitest', assertions: 0 },
] as const;
