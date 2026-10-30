export const TESTING_LIBRARY_CASES = [
    ['react', '@testing-library/react'],
    ['vue', '@testing-library/vue'],
    ['svelte', '@testing-library/svelte'],
] as const;

export const ASSERTION_RULE_OWNERS = [
    { name: 'no test framework', configuration: undefined, assertions: 2 },
    { name: 'jest', configuration: 'jest', assertions: 0 },
    { name: 'vitest', configuration: 'vitest', assertions: 0 },
] as const;
