import { z } from 'zod';

const FULL_PERCENTAGE = 100;

export const jestPercentage = z.number().min(0).max(FULL_PERCENTAGE);

/** Coverage floors shared by policy validation and native Jest execution. */
export const jestCoverageSettings = z.object({
    coverage_lines: jestPercentage,
    coverage_branches: jestPercentage,
    coverage_functions: jestPercentage,
    coverage_statements: jestPercentage,
});
