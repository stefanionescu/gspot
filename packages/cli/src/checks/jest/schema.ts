import { z } from 'zod';

export const jestPercentage = z.number().min(0).max(100);

/** Coverage floors shared by policy validation and native Jest execution. */
export const jestCoverageSettings = z.object({
    coverage_lines: jestPercentage,
    coverage_branches: jestPercentage,
    coverage_functions: jestPercentage,
    coverage_statements: jestPercentage,
});
