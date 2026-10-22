/** A run with zero coverage limits checks tests without asking for a coverage provider. */
export const COVERAGE_ZERO_LIMITS = `[coverage]
lines = { value = 0, reason = "This test checks execution without coverage collection." }
branches = { value = 0, reason = "This test checks execution without coverage collection." }
functions = { value = 0, reason = "This test checks execution without coverage collection." }
statements = { value = 0, reason = "This test checks execution without coverage collection." }
`;
