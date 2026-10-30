export const TESTING_LIBRARY_CASES = [['react', '@testing-library/react']] as const;

export const ASSERTION_RULE_OWNERS = [
    { name: 'no test framework', configuration: undefined, assertions: 2 },
    { name: 'jest', configuration: 'jest', assertions: 0 },
] as const;
